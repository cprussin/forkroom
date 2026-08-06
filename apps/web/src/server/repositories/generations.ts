import { z } from "zod";
import type {
  GenerationEntity,
  GenerationStatus,
} from "../../contracts/chat-entities";
import { generationEntitySchema } from "../../contracts/chat-entities";
import { execute, queryOne, queryRows } from "../db/client";
import type { Queryable } from "../db/pool";

const GENERATION_COLUMNS = `
  id                    AS "id",
  chat_id               AS "chatId",
  branch_id             AS "branchId",
  user_message_id       AS "userMessageId",
  assistant_message_id  AS "assistantMessageId",
  status                AS "status",
  provider              AS "provider",
  model                 AS "model",
  error_code            AS "errorCode"
`;

export type NewGeneration = {
  id: string;
  chatId: string;
  branchId: string;
  userMessageId: string;
  assistantMessageId: string;
  provider: string;
  model: string;
};

export const insertGeneration = (
  db: Queryable,
  generation: NewGeneration,
): Promise<GenerationEntity> =>
  queryOne(
    db,
    generationEntitySchema,
    `INSERT INTO generations
       (id, chat_id, branch_id, user_message_id, assistant_message_id, status, provider, model)
     VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7)
     RETURNING ${GENERATION_COLUMNS}`,
    [
      generation.id,
      generation.chatId,
      generation.branchId,
      generation.userMessageId,
      generation.assistantMessageId,
      generation.provider,
      generation.model,
    ],
  );

export const getGeneration = async (
  db: Queryable,
  generationId: string,
): Promise<GenerationEntity | undefined> => {
  const rows = await queryRows(
    db,
    generationEntitySchema,
    `SELECT ${GENERATION_COLUMNS} FROM generations WHERE id = $1`,
    [generationId],
  );
  const [row] = rows;
  return row;
};

export const listGenerations = (
  db: Queryable,
  chatId: string,
): Promise<GenerationEntity[]> =>
  queryRows(
    db,
    generationEntitySchema,
    `SELECT ${GENERATION_COLUMNS} FROM generations WHERE chat_id = $1`,
    [chatId],
  );

export const setGenerationStatus = async (
  db: Queryable,
  generationId: string,
  status: GenerationStatus,
  fields: {
    errorCode?: string | undefined;
    firstTokenMs?: number | undefined;
    latencyMs?: number | undefined;
    promptTokens?: number | undefined;
    completionTokens?: number | undefined;
  } = {},
): Promise<void> => {
  await execute(
    db,
    `UPDATE generations
        SET status = $2,
            error_code = COALESCE($3, error_code),
            first_token_ms = COALESCE($4, first_token_ms),
            latency_ms = COALESCE($5, latency_ms),
            prompt_tokens = COALESCE($6, prompt_tokens),
            completion_tokens = COALESCE($7, completion_tokens),
            started_at = CASE WHEN $2 = 'streaming' THEN COALESCE(started_at, now()) ELSE started_at END,
            completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN now() ELSE completed_at END,
            updated_at = now()
      WHERE id = $1`,
    [
      generationId,
      status,
      fields.errorCode ?? null,
      fields.firstTokenMs ?? null,
      fields.latencyMs ?? null,
      fields.promptTokens ?? null,
      fields.completionTokens ?? null,
    ],
  );
};

const activeRowSchema = z.object({ count: z.coerce.number() });

/** Whether a branch already has a queued or streaming generation. */
export const hasActiveGeneration = async (
  db: Queryable,
  branchId: string,
): Promise<boolean> => {
  const row = await queryOne(
    db,
    activeRowSchema,
    `SELECT COUNT(*) AS count FROM generations
      WHERE branch_id = $1 AND status IN ('queued', 'streaming')`,
    [branchId],
  );
  return row.count > 0;
};
