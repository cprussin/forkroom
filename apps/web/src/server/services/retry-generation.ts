import type { Result } from "@cprussin/option-result";
import { Err, Ok } from "@cprussin/option-result";
import { ChatEventType } from "../../contracts/chat-events";
import { execute, withTransaction } from "../db/client";
import type { Queryable } from "../db/pool";
import { getPool } from "../db/pool";
import { authorizeRetry, RetryDenialReason } from "../domain/authorization";
import { getBranch } from "../repositories/branches";
import { getGeneration } from "../repositories/generations";
import { requeueGenerationJob } from "../repositories/jobs";
import { getMemberRole } from "../repositories/members";
import { updateMessageContent } from "../repositories/messages";
import { appendOutboxEvent } from "../repositories/outbox";
import type { DomainError } from "./domain-error";
import { DomainErrors } from "./domain-error";

/**
 * Retry a failed generation. Idempotent and additive-free: it never inserts
 * another user message (PRD §7.4). A generation already queued/streaming is a
 * no-op success; a completed one cannot be retried; a failed one is reset to
 * queued and re-enqueued.
 */
export const retryGeneration = (
  input: { chatId: string; generationId: string; userId: string },
  pool = getPool(),
): Promise<Result<{ generationId: string }, DomainError>> =>
  withTransaction(async (tx) => {
    const generation = await getGeneration(tx, input.generationId);
    if (generation === undefined || generation.chatId !== input.chatId) {
      return Err(DomainErrors.notFound());
    }

    const branch = await getBranch(tx, input.chatId, generation.branchId);
    if (branch === undefined) {
      return Err(DomainErrors.notFound());
    }

    const role = await getMemberRole(tx, input.chatId, input.userId);
    const denied = authorizeRetry({
      isMainBranch: branch.isMain,
      membership: role,
      ownsBranch: branch.ownerUserId === input.userId,
    }).match<DomainError | undefined>({
      Err: (denial) =>
        denial.reason === RetryDenialReason.NotMember
          ? DomainErrors.notMember()
          : DomainErrors.forbidden(),
      Ok: () => undefined,
    });
    if (denied !== undefined) {
      return Err(denied);
    }

    switch (generation.status) {
      case "queued":
      case "streaming": {
        return Ok({ generationId: generation.id });
      }
      case "completed": {
        return Err(DomainErrors.notRetryable());
      }
      case "failed": {
        return requeue(
          tx,
          generation.id,
          generation.assistantMessageId,
          input.chatId,
        );
      }
    }
  }, pool);

const requeue = async (
  tx: Queryable,
  generationId: string,
  assistantMessageId: string,
  chatId: string,
): Promise<Result<{ generationId: string }, DomainError>> => {
  await execute(
    tx,
    `UPDATE generations
        SET status = 'queued', error_code = NULL, attempt_count = attempt_count + 1,
            completed_at = NULL, updated_at = now()
      WHERE id = $1`,
    [generationId],
  );
  const assistant = await updateMessageContent(
    tx,
    assistantMessageId,
    "",
    "queued",
  );
  await requeueGenerationJob(tx, generationId);

  const generation = await getGeneration(tx, generationId);
  if (generation !== undefined) {
    await appendOutboxEvent(
      tx,
      chatId,
      ChatEventType.GenerationUpdated,
      generationId,
      {
        generation,
      },
    );
  }
  await appendOutboxEvent(
    tx,
    chatId,
    ChatEventType.MessageUpdated,
    assistantMessageId,
    {
      message: assistant,
    },
  );
  return Ok({ generationId });
};
