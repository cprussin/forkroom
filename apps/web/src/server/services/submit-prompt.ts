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
import {
  authorizeSubmission,
  SubmissionDenialReason,
} from "../domain/authorization";
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
import { insertMessage, nextSequenceNumber } from "../repositories/messages";
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

  const authorized = authorizeSubmission({
    membership,
    ownsSelectedBranch: selected.ownerUserId === userId,
    selectedIsMain: selected.isMain,
  }).match<AuthorizedSubmission>({
    Err: (denial) => ({
      error:
        denial.reason === SubmissionDenialReason.NotMember
          ? DomainErrors.notMember()
          : DomainErrors.creatorOffMain(),
      ok: false,
    }),
    Ok: (mode) => ({ mode, ok: true }),
  });
  if (!authorized.ok) {
    return Err(authorized.error);
  }
  const outcome = authorized.mode;

  const currentTip = await getBranchTip(tx, chatId, body.selectedBranchId);
  const expectedTip = body.expectedTipMessageId ?? undefined;
  if (currentTip !== expectedTip) {
    return Err(DomainErrors.staleTip());
  }

  if (outcome === SubmissionOutcome.Append) {
    const active = await hasActiveGeneration(tx, selected.id);
    if (active) {
      return Err(DomainErrors.generationInProgress());
    }
  }

  const plan = await planTarget(tx, {
    chatId,
    forkPoint: currentTip,
    mint,
    outcome,
    selected,
    userId,
  });

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

const planTarget = async (
  tx: Queryable,
  args: {
    chatId: string;
    userId: string;
    selected: BranchEntity;
    outcome: SubmissionOutcome;
    forkPoint: string | undefined;
    mint: IdGenerator;
  },
): Promise<TargetPlan> => {
  switch (args.outcome) {
    case SubmissionOutcome.Append: {
      return {
        branchCreated: undefined,
        responseForkMessageId: args.selected.forkMessageId,
        responseParentBranchId: args.selected.parentBranchId,
        targetBranchId: args.selected.id,
      };
    }
    case SubmissionOutcome.Fork: {
      const branch = await insertBranch(tx, {
        chatId: args.chatId,
        createdByUserId: args.userId,
        forkMessageId: args.forkPoint,
        id: args.mint(),
        ownerUserId: args.userId,
        parentBranchId: args.selected.id,
      });
      return {
        branchCreated: branch,
        responseForkMessageId: args.forkPoint,
        responseParentBranchId: args.selected.id,
        targetBranchId: branch.id,
      };
    }
    case SubmissionOutcome.CreatorMustReturnToMain: {
      throw new Error("unreachable: creator-off-main handled before planning");
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
