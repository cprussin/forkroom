import type { Pool } from "pg";
import { ChatEventType } from "../../contracts/chat-events";
import { withTransaction } from "../db/client";
import type { Queryable } from "../db/pool";
import { getPool } from "../db/pool";
import { buildBranchContext } from "../domain/context";
import { listBranches } from "../repositories/branches";
import {
  getGeneration,
  setGenerationStatus,
} from "../repositories/generations";
import { listMessages, updateMessageContent } from "../repositories/messages";
import { appendOutboxEvent } from "../repositories/outbox";
import type { ChatModel } from "./model/provider";
import { toModelMessages } from "./to-model-messages";

export type RunGenerationDeps = {
  model: ChatModel;
  systemPrompt: string;
  checkpointIntervalMs?: number;
  now?: () => number;
};

const DEFAULT_CHECKPOINT_MS = 300;

/**
 * Produce one assistant response for a queued/streaming generation: mark it
 * streaming, build the model context by walking branch ancestry, stream the
 * reply while checkpointing accumulated text to the database (each checkpoint
 * is a committed outbox event that repairs any missed delta), and persist the
 * completed content plus metadata. Model failures are persisted as a sanitized
 * `failed` state — never rethrown — leaving the user's prompt intact and a
 * retry available. Infrastructure failures throw so the worker can reschedule.
 *
 * Idempotent under crash recovery: a generation left `streaming` by a crashed
 * worker is reset and re-streamed into the same assistant message, so retries
 * never create a second assistant message.
 */
export const runGeneration = async (
  generationId: string,
  deps: RunGenerationDeps,
  signal: AbortSignal,
  pool = getPool(),
): Promise<void> => {
  const generation = await getGeneration(pool, generationId);
  if (generation === undefined) {
    return;
  }
  if (generation.status === "completed" || generation.status === "failed") {
    return;
  }

  const now = deps.now ?? Date.now;
  const startedAt = now();
  await beginStreaming(
    pool,
    generation.chatId,
    generation.id,
    generation.assistantMessageId,
  );

  const modelMessages = await buildContext(pool, generation, deps.systemPrompt);
  const checkpointMs = deps.checkpointIntervalMs ?? DEFAULT_CHECKPOINT_MS;

  try {
    let accumulated = "";
    let firstTokenMs: number | undefined;
    let lastCheckpoint = startedAt;
    for await (const chunk of deps.model.stream({
      messages: modelMessages,
      signal,
    })) {
      accumulated += chunk.textDelta;
      if (firstTokenMs === undefined) {
        firstTokenMs = now() - startedAt;
      }
      if (now() - lastCheckpoint >= checkpointMs) {
        await checkpoint(pool, generation, accumulated, "streaming");
        lastCheckpoint = now();
      }
    }
    await finish(pool, generation, accumulated, {
      firstTokenMs,
      latencyMs: now() - startedAt,
    });
  } catch (error) {
    // Surface the provider failure cause so it can be diagnosed from server
    // logs. The message is the provider's own error (e.g. a 401/404 category),
    // never the prompt or response content (PRD §14).
    // biome-ignore lint/suspicious/noConsole: operational visibility for generation failures
    console.error(
      `generation ${generation.id} failed (${classifyError(error)}): ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    await fail(pool, generation, classifyError(error));
  }
};

const beginStreaming = (
  pool: Pool,
  chatId: string,
  generationId: string,
  assistantMessageId: string,
): Promise<void> =>
  withTransaction(async (tx) => {
    await setGenerationStatus(tx, generationId, "streaming");
    const message = await updateMessageContent(
      tx,
      assistantMessageId,
      "",
      "streaming",
    );
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
        message,
      },
    );
  }, pool);

const buildContext = async (
  db: Queryable,
  generation: { chatId: string; branchId: string; userMessageId: string },
  systemPrompt: string,
) => {
  const [branches, messages] = await Promise.all([
    listBranches(db, generation.chatId),
    listMessages(db, generation.chatId),
  ]);
  const context = buildBranchContext({
    branches: branches.map((branch) => ({
      forkMessageId: branch.forkMessageId,
      id: branch.id,
      parentBranchId: branch.parentBranchId,
    })),
    branchId: generation.branchId,
    messages: messages.map((message) => ({
      branchId: message.branchId,
      content: message.content,
      id: message.id,
      role: message.role,
      sequenceNumber: message.sequenceNumber,
      status: message.status,
    })),
    targetMessageId: generation.userMessageId,
  });
  return toModelMessages(context, systemPrompt);
};

const checkpoint = (
  pool: Pool,
  generation: { chatId: string; assistantMessageId: string },
  content: string,
  status: "streaming" | "completed",
): Promise<void> =>
  withTransaction(async (tx) => {
    const message = await updateMessageContent(
      tx,
      generation.assistantMessageId,
      content,
      status,
    );
    await appendOutboxEvent(
      tx,
      generation.chatId,
      ChatEventType.MessageUpdated,
      generation.assistantMessageId,
      { message },
    );
  }, pool);

const finish = (
  pool: Pool,
  generation: { chatId: string; id: string; assistantMessageId: string },
  content: string,
  metrics: { firstTokenMs: number | undefined; latencyMs: number },
): Promise<void> =>
  withTransaction(async (tx) => {
    const message = await updateMessageContent(
      tx,
      generation.assistantMessageId,
      content,
      "completed",
    );
    await setGenerationStatus(tx, generation.id, "completed", {
      firstTokenMs: metrics.firstTokenMs,
      latencyMs: metrics.latencyMs,
    });
    const updated = await getGeneration(tx, generation.id);
    await appendOutboxEvent(
      tx,
      generation.chatId,
      ChatEventType.MessageUpdated,
      generation.assistantMessageId,
      { message },
    );
    if (updated !== undefined) {
      await appendOutboxEvent(
        tx,
        generation.chatId,
        ChatEventType.GenerationUpdated,
        generation.id,
        {
          generation: updated,
        },
      );
    }
  }, pool);

const fail = (
  pool: Pool,
  generation: { chatId: string; id: string; assistantMessageId: string },
  errorCode: string,
): Promise<void> =>
  withTransaction(async (tx) => {
    const message = await updateMessageContent(
      tx,
      generation.assistantMessageId,
      "",
      "failed",
    );
    await setGenerationStatus(tx, generation.id, "failed", { errorCode });
    const updated = await getGeneration(tx, generation.id);
    await appendOutboxEvent(
      tx,
      generation.chatId,
      ChatEventType.MessageUpdated,
      generation.assistantMessageId,
      { message },
    );
    if (updated !== undefined) {
      await appendOutboxEvent(
        tx,
        generation.chatId,
        ChatEventType.GenerationUpdated,
        generation.id,
        {
          generation: updated,
        },
      );
    }
  }, pool);

// Reduce any model failure to a coarse, non-sensitive category. Never surfaces
// provider messages or secrets (PRD §7.4, §12).
const classifyError = (error: unknown): string => {
  if (error instanceof Error && error.message === "aborted") {
    return "aborted";
  } else {
    return "model_error";
  }
};
