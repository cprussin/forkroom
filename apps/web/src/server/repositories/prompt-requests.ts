import { z } from "zod";
import { queryRows } from "../db/client";
import type { Queryable } from "../db/pool";

const promptRequestSchema = z.object({
  branchId: z.string(),
  generationId: z.string(),
  userMessageId: z.string(),
});
export type StoredPromptRequest = z.infer<typeof promptRequestSchema>;

/** The canonical result of a prior prompt request, keyed for idempotent replay. */
export const findPromptRequest = async (
  db: Queryable,
  idempotencyKey: string,
  userId: string,
  chatId: string,
): Promise<StoredPromptRequest | undefined> => {
  const rows = await queryRows(
    db,
    promptRequestSchema,
    `SELECT branch_id AS "branchId", user_message_id AS "userMessageId", generation_id AS "generationId"
       FROM prompt_requests
      WHERE idempotency_key = $1 AND user_id = $2 AND chat_id = $3`,
    [idempotencyKey, userId, chatId],
  );
  const [row] = rows;
  return row;
};

/**
 * Record a committed prompt request. `ON CONFLICT DO NOTHING` + `RETURNING`
 * distinguishes the first writer (a row returned) from a concurrent replay (no
 * row), so a racing duplicate can fall back to reading the original result.
 */
export const insertPromptRequest = async (
  db: Queryable,
  request: StoredPromptRequest & {
    idempotencyKey: string;
    userId: string;
    chatId: string;
  },
): Promise<boolean> => {
  const rows = await queryRows(
    db,
    z.object({ idempotency_key: z.string() }),
    `INSERT INTO prompt_requests
       (idempotency_key, user_id, chat_id, branch_id, user_message_id, generation_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (idempotency_key, user_id, chat_id) DO NOTHING
     RETURNING idempotency_key`,
    [
      request.idempotencyKey,
      request.userId,
      request.chatId,
      request.branchId,
      request.userMessageId,
      request.generationId,
    ],
  );
  return rows.length > 0;
};
