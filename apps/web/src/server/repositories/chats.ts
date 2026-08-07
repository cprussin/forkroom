import { z } from "zod";
import type { ChatListItem } from "../../contracts/chat-list";
import { chatListItemSchema } from "../../contracts/chat-list";
import { execute, queryOne, queryRows } from "../db/client";
import type { Queryable } from "../db/pool";

export const insertChat = async (
  db: Queryable,
  chat: { id: string; title: string; creatorUserId: string },
): Promise<void> => {
  await execute(
    db,
    "INSERT INTO chats (id, title, creator_user_id) VALUES ($1, $2, $3)",
    [chat.id, chat.title, chat.creatorUserId],
  );
};

export const setMainBranch = async (
  db: Queryable,
  chatId: string,
  branchId: string,
): Promise<void> => {
  await execute(db, "UPDATE chats SET main_branch_id = $2 WHERE id = $1", [
    chatId,
    branchId,
  ]);
};

export const setChatTitle = async (
  db: Queryable,
  chatId: string,
  title: string,
): Promise<void> => {
  await execute(db, "UPDATE chats SET title = $2 WHERE id = $1", [
    chatId,
    title,
  ]);
};

/**
 * The chats a user is a member of, most recently active first — the sidebar's
 * history. Activity is the latest message, falling back to the chat's creation
 * time for a chat with no messages yet.
 */
export const listChatsForUser = (
  db: Queryable,
  userId: string,
): Promise<ChatListItem[]> =>
  queryRows(
    db,
    chatListItemSchema,
    `SELECT c.id AS "id",
            c.title AS "title",
            GREATEST(
              c.created_at,
              COALESCE(MAX(m.created_at), c.created_at)
            ) AS "lastActivityAt"
       FROM chats c
       JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = $1
       LEFT JOIN messages m ON m.chat_id = c.id
      GROUP BY c.id, c.title, c.created_at
      ORDER BY "lastActivityAt" DESC`,
    [userId],
  );

const chatMetaSchema = z.object({
  createdAt: z.union([z.string(), z.date()]),
  creatorUserId: z.string(),
  id: z.string(),
  mainBranchId: z.string(),
  title: z.string(),
});
export type ChatMeta = z.infer<typeof chatMetaSchema>;

export const getChatMeta = async (
  db: Queryable,
  chatId: string,
): Promise<ChatMeta | undefined> => {
  const rows = await queryRows(
    db,
    chatMetaSchema,
    `SELECT id AS "id",
            title AS "title",
            creator_user_id AS "creatorUserId",
            main_branch_id AS "mainBranchId",
            created_at AS "createdAt"
       FROM chats WHERE id = $1`,
    [chatId],
  );
  const [row] = rows;
  return row;
};

const titlePreviewSchema = z.object({
  creatorDisplayName: z.string(),
  title: z.string(),
});
export type ChatPreview = z.infer<typeof titlePreviewSchema>;

/** Minimal chat identity for an invitation preview (title + creator only). */
export const getChatPreview = async (
  db: Queryable,
  chatId: string,
): Promise<ChatPreview | undefined> => {
  const rows = await queryRows(
    db,
    titlePreviewSchema,
    `SELECT c.title AS "title", u.display_name AS "creatorDisplayName"
       FROM chats c
       JOIN users u ON u.id = c.creator_user_id
      WHERE c.id = $1`,
    [chatId],
  );
  const [row] = rows;
  return row;
};

export const countChatMembers = async (
  db: Queryable,
  chatId: string,
): Promise<number> => {
  const row = await queryOne(
    db,
    z.object({ count: z.coerce.number() }),
    "SELECT COUNT(*) AS count FROM chat_members WHERE chat_id = $1",
    [chatId],
  );
  return row.count;
};
