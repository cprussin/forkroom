import { z } from "zod";
import type {
  MessageEntity,
  MessageRole,
  MessageStatus,
} from "../../contracts/chat-entities";
import { messageEntitySchema } from "../../contracts/chat-entities";
import { execute, queryOne, queryRows } from "../db/client";
import type { Queryable } from "../db/pool";

const MESSAGE_COLUMNS = `
  id                AS "id",
  chat_id           AS "chatId",
  branch_id         AS "branchId",
  role              AS "role",
  author_user_id    AS "authorUserId",
  content           AS "content",
  status            AS "status",
  sequence_number   AS "sequenceNumber",
  created_at        AS "createdAt"
`;

export type NewMessage = {
  id: string;
  chatId: string;
  branchId: string;
  role: MessageRole;
  authorUserId: string | undefined;
  content: string;
  status: MessageStatus;
  sequenceNumber: number;
};

export const insertMessage = (
  db: Queryable,
  message: NewMessage,
): Promise<MessageEntity> =>
  queryOne(
    db,
    messageEntitySchema,
    `INSERT INTO messages
       (id, chat_id, branch_id, role, author_user_id, content, status, sequence_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${MESSAGE_COLUMNS}`,
    [
      message.id,
      message.chatId,
      message.branchId,
      message.role,
      message.authorUserId ?? null,
      message.content,
      message.status,
      message.sequenceNumber,
    ],
  );

const nextSequenceRowSchema = z.object({ next: z.number() });

/** The next unused sequence number on a branch (1 for an empty branch). */
export const nextSequenceNumber = async (
  db: Queryable,
  branchId: string,
): Promise<number> => {
  const row = await queryOne(
    db,
    nextSequenceRowSchema,
    `SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next
       FROM messages WHERE branch_id = $1`,
    [branchId],
  );
  return row.next;
};

export const getMessage = async (
  db: Queryable,
  messageId: string,
): Promise<MessageEntity | undefined> => {
  const rows = await queryRows(
    db,
    messageEntitySchema,
    `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = $1`,
    [messageId],
  );
  const [row] = rows;
  return row;
};

export const listMessages = (
  db: Queryable,
  chatId: string,
): Promise<MessageEntity[]> =>
  queryRows(
    db,
    messageEntitySchema,
    `SELECT ${MESSAGE_COLUMNS} FROM messages
      WHERE chat_id = $1
      ORDER BY branch_id, sequence_number ASC`,
    [chatId],
  );

export const updateMessageContent = (
  db: Queryable,
  messageId: string,
  content: string,
  status: MessageStatus,
): Promise<MessageEntity> =>
  queryOne(
    db,
    messageEntitySchema,
    `UPDATE messages
        SET content = $2, status = $3, updated_at = now()
      WHERE id = $1
      RETURNING ${MESSAGE_COLUMNS}`,
    [messageId, content, status],
  );

export const setMessageStatus = async (
  db: Queryable,
  messageId: string,
  status: MessageStatus,
): Promise<void> => {
  await execute(
    db,
    "UPDATE messages SET status = $2, updated_at = now() WHERE id = $1",
    [messageId, status],
  );
};
