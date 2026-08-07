import type { Result } from "@cprussin/option-result";
import { Err, Ok } from "@cprussin/option-result";
import type { BranchEntity } from "../../contracts/chat-entities";
import { ChatEventType } from "../../contracts/chat-events";
import type {
  SubmitPromptRequest,
  SubmitPromptResponse,
} from "../../contracts/prompt";
import { withTransaction } from "../db/client";
import type { Queryable } from "../db/pool";
import { getPool } from "../db/pool";
import { authorizeSubmission } from "../domain/authorization";
import { SubmissionOutcome } from "../domain/branching";
import type { IdGenerator } from "../domain/ids";
import { newId as defaultNewId } from "../domain/ids";
import {
  getBranch,
  getBranchTip,
  insertBranch,
} from "../repositories/branches";
import { getChatMeta } from "../repositories/chats";
import {
  hasActiveGeneration,
  insertGeneration,
} from "../repositories/generations";
import { enqueueGenerationJob } from "../repositories/jobs";
import { getMemberRole } from "../repositories/members";
import {
  getMessage,
  insertMessage,
  nextSequenceNumber,
} from "../repositories/messages";
import { appendOutboxEvent } from "../repositories/outbox";
import {
  findPromptRequest,
  insertPromptRequest,
} from "../repositories/prompt-requests";
import type { DomainError } from "./domain-error";
import { DomainErrors } from "./domain-error";

export type SubmitPromptDeps = {
  provider: string;
  model: string;
  maxPromptChars: number;
  newId?: IdGenerator;
};

export type SubmitPromptInput = {
  chatId: string;
  userId: string;
  body: SubmitPromptRequest;
};

/**
 * Commit a prompt submission, deciding append vs fork server-side, and enqueue
 * its generation — all in one transaction so a branch/message/generation and
 * their outbox events either all commit or none do (PRD §7.4, §7.6). The
 * assistant response is produced asynchronously by the worker; this call
 * returns as soon as the transaction commits.
 */
export const submitPrompt = async (
  input: SubmitPromptInput,
  deps: SubmitPromptDeps,
  pool = getPool(),
): Promise<Result<SubmitPromptResponse, DomainError>> => {
  const contentLength = [...input.body.content].length;
  if (contentLength > deps.maxPromptChars) {
    return Err(DomainErrors.promptTooLong());
  } else {
    try {
      return await withTransaction(
        (tx) => runSubmission(tx, input, deps),
        pool,
      );
    } catch (error) {
      const mapped = mapWriteConflict(error);
      if (mapped === undefined) {
        throw error;
      } else {
        return Err(mapped);
      }
    }
  }
};

const runSubmission = async (
  tx: Queryable,
  input: SubmitPromptInput,
  deps: SubmitPromptDeps,
): Promise<Result<SubmitPromptResponse, DomainError>> => {
  const mint = deps.newId ?? defaultNewId;
  const { chatId, userId, body } = input;

  // Serialize same-key submissions so a concurrent duplicate blocks until the
  // first commits, then replays its result rather than doing the work twice.
  await tx.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [
    `${body.idempotencyKey}:${userId}:${chatId}`,
  ]);

  const replay = await findPromptRequest(
    tx,
    body.idempotencyKey,
    userId,
    chatId,
  );
  if (replay === undefined) {
    return runFreshSubmission(tx, input, deps, mint);
  } else {
    const branch = await getBranch(tx, chatId, replay.branchId);
    if (branch === undefined) {
      throw new Error("prompt_request references a missing branch");
    } else {
      return Ok(buildResponse(branch, replay, body.selectedBranchId));
    }
  }
};

const runFreshSubmission = async (
  tx: Queryable,
  input: SubmitPromptInput,
  deps: SubmitPromptDeps,
  mint: IdGenerator,
): Promise<Result<SubmitPromptResponse, DomainError>> => {
  const { chatId, userId, body } = input;

  const chat = await getChatMeta(tx, chatId);
  if (chat === undefined) {
    return Err(DomainErrors.chatNotFound());
  }

  const membership = await getMemberRole(tx, chatId, userId);
  const selected = await getBranch(tx, chatId, body.selectedBranchId, true);
  if (selected === undefined) {
    return Err(DomainErrors.branchNotFound());
  }

  const forkPointMessageId = body.forkPointMessageId ?? undefined;
  const authorized = authorizeSubmission({
    explicitForkRequested: forkPointMessageId !== undefined,
    membership,
    ownsSelectedBranch: selected.ownerUserId === userId,
  }).match<AuthorizedSubmission>({
    Err: () => ({ error: DomainErrors.notMember(), ok: false }),
    Ok: (mode) => ({ mode, ok: true }),
  });
  if (!authorized.ok) {
    return Err(authorized.error);
  }

  const planned = await planTarget(tx, {
    chatId,
    expectedTip: body.expectedTipMessageId ?? undefined,
    forkPointMessageId,
    mint,
    outcome: authorized.mode,
    selected,
    userId,
  });
  if (!planned.ok) {
    return Err(planned.error);
  }
  const plan = planned.plan;

  const seq = await nextSequenceNumber(tx, plan.targetBranchId);
  const userMessage = await insertMessage(tx, {
    authorUserId: userId,
    branchId: plan.targetBranchId,
    chatId,
    content: body.content,
    id: mint(),
    role: "user",
    sequenceNumber: seq,
    status: "completed",
  });
  const assistantMessage = await insertMessage(tx, {
    authorUserId: undefined,
    branchId: plan.targetBranchId,
    chatId,
    content: "",
    id: mint(),
    role: "assistant",
    sequenceNumber: seq + 1,
    status: "queued",
  });
  const generation = await insertGeneration(tx, {
    assistantMessageId: assistantMessage.id,
    branchId: plan.targetBranchId,
    chatId,
    id: mint(),
    model: deps.model,
    provider: deps.provider,
    userMessageId: userMessage.id,
  });
  await enqueueGenerationJob(tx, mint(), generation.id);

  const firstWriter = await insertPromptRequest(tx, {
    branchId: plan.targetBranchId,
    chatId,
    generationId: generation.id,
    idempotencyKey: body.idempotencyKey,
    userId,
    userMessageId: userMessage.id,
  });
  if (!firstWriter) {
    throw new Error("idempotency race not serialized by advisory lock");
  }

  if (plan.branchCreated !== undefined) {
    await appendOutboxEvent(
      tx,
      chatId,
      ChatEventType.BranchCreated,
      plan.branchCreated.id,
      { branch: plan.branchCreated },
    );
  }
  await appendOutboxEvent(
    tx,
    chatId,
    ChatEventType.MessageCreated,
    userMessage.id,
    {
      message: userMessage,
    },
  );
  await appendOutboxEvent(
    tx,
    chatId,
    ChatEventType.MessageCreated,
    assistantMessage.id,
    { message: assistantMessage },
  );
  await appendOutboxEvent(
    tx,
    chatId,
    ChatEventType.GenerationUpdated,
    generation.id,
    { generation },
  );

  return Ok({
    branchId: plan.targetBranchId,
    forkMessageId: plan.responseForkMessageId ?? null,
    generationId: generation.id,
    mode: plan.branchCreated === undefined ? "appended" : "forked",
    parentBranchId: plan.responseParentBranchId ?? null,
    userMessageId: userMessage.id,
  });
};

type AuthorizedSubmission =
  | { ok: true; mode: SubmissionOutcome }
  | { ok: false; error: DomainError };

type TargetPlan = {
  targetBranchId: string;
  branchCreated: BranchEntity | undefined;
  responseParentBranchId: string | undefined;
  responseForkMessageId: string | undefined;
};

type PlannedTarget =
  | { ok: true; plan: TargetPlan }
  | { ok: false; error: DomainError };

/**
 * Resolve where a submission lands. An append validates the branch tip is
 * unchanged and idle, then targets the selected branch. A fork springs a new
 * branch from either the tip of the selected branch (implicit) or a named
 * message in history (explicit `forkPointMessageId`).
 */
const planTarget = async (
  tx: Queryable,
  args: {
    chatId: string;
    userId: string;
    selected: BranchEntity;
    outcome: SubmissionOutcome;
    expectedTip: string | undefined;
    forkPointMessageId: string | undefined;
    mint: IdGenerator;
  },
): Promise<PlannedTarget> => {
  switch (args.outcome) {
    case SubmissionOutcome.Append: {
      const currentTip = await getBranchTip(tx, args.chatId, args.selected.id);
      if (currentTip !== args.expectedTip) {
        return { error: DomainErrors.staleTip(), ok: false };
      } else if (await hasActiveGeneration(tx, args.selected.id)) {
        return { error: DomainErrors.generationInProgress(), ok: false };
      } else {
        return {
          ok: true,
          plan: {
            branchCreated: undefined,
            responseForkMessageId: args.selected.forkMessageId,
            responseParentBranchId: args.selected.parentBranchId,
            targetBranchId: args.selected.id,
          },
        };
      }
    }
    case SubmissionOutcome.Fork: {
      const origin = await resolveForkOrigin(tx, args);
      if (origin.ok) {
        const branch = await insertBranch(tx, {
          chatId: args.chatId,
          createdByUserId: args.userId,
          forkMessageId: origin.forkPoint,
          id: args.mint(),
          ownerUserId: args.userId,
          parentBranchId: origin.parentBranchId,
        });
        return {
          ok: true,
          plan: {
            branchCreated: branch,
            responseForkMessageId: origin.forkPoint,
            responseParentBranchId: origin.parentBranchId,
            targetBranchId: branch.id,
          },
        };
      } else {
        return origin;
      }
    }
  }
};

type ForkOrigin =
  | { ok: true; parentBranchId: string; forkPoint: string | undefined }
  | { ok: false; error: DomainError };

/**
 * Where a fork branches from: an explicit `forkPointMessageId` names a
 * completed message anywhere in the chat's history (its branch becomes the
 * parent); otherwise the fork springs from the tip of the selected branch,
 * which must still match the tip the client saw.
 */
const resolveForkOrigin = async (
  tx: Queryable,
  args: {
    chatId: string;
    selected: BranchEntity;
    expectedTip: string | undefined;
    forkPointMessageId: string | undefined;
  },
): Promise<ForkOrigin> => {
  if (args.forkPointMessageId === undefined) {
    const currentTip = await getBranchTip(tx, args.chatId, args.selected.id);
    if (currentTip === args.expectedTip) {
      return {
        forkPoint: currentTip,
        ok: true,
        parentBranchId: args.selected.id,
      };
    } else {
      return { error: DomainErrors.staleTip(), ok: false };
    }
  } else {
    const message = await getMessage(tx, args.forkPointMessageId);
    if (
      message === undefined ||
      message.chatId !== args.chatId ||
      message.status !== "completed"
    ) {
      return { error: DomainErrors.invalidForkPoint(), ok: false };
    } else {
      return {
        forkPoint: message.id,
        ok: true,
        parentBranchId: message.branchId,
      };
    }
  }
};

const buildResponse = (
  branch: BranchEntity,
  replay: { branchId: string; userMessageId: string; generationId: string },
  selectedBranchId: string,
): SubmitPromptResponse => ({
  branchId: replay.branchId,
  forkMessageId: branch.forkMessageId ?? null,
  generationId: replay.generationId,
  mode: replay.branchId === selectedBranchId ? "appended" : "forked",
  parentBranchId: branch.parentBranchId ?? null,
  userMessageId: replay.userMessageId,
});

// Map the unique-constraint violations that encode our concurrency invariants
// to their domain errors; anything else is a real fault and rethrown.
const mapWriteConflict = (error: unknown): DomainError | undefined => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    const constraint =
      "constraint" in error && typeof error.constraint === "string"
        ? error.constraint
        : "";
    switch (constraint) {
      case "generations_one_active_per_branch": {
        return DomainErrors.generationInProgress();
      }
      case "messages_branch_id_sequence_number_key": {
        return DomainErrors.staleTip();
      }
      default: {
        return undefined;
      }
    }
  } else {
    return undefined;
  }
};
