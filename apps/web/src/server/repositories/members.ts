import { z } from "zod";
import type { MemberEntity } from "../../contracts/chat-entities";
import { memberEntitySchema } from "../../contracts/chat-entities";
import { execute, queryRows } from "../db/client";
import type { Queryable } from "../db/pool";
import type { Role } from "../domain/roles";
import { roleFromWire } from "../domain/roles";

const roleRowSchema = z.object({
  role: z.enum(["creator", "participant"]),
});

/** The requesting user's role in a chat, or `undefined` when not a member. */
export const getMemberRole = async (
  db: Queryable,
  chatId: string,
  userId: string,
): Promise<Role | undefined> => {
  const rows = await queryRows(
    db,
    roleRowSchema,
    "SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2",
    [chatId, userId],
  );
  const [row] = rows;
  return row === undefined ? undefined : roleFromWire(row.role);
};

/** Insert a membership, ignoring a duplicate (idempotent invite acceptance). */
export const insertMember = async (
  db: Queryable,
  chatId: string,
  userId: string,
  role: "creator" | "participant",
): Promise<void> => {
  await execute(
    db,
    `INSERT INTO chat_members (chat_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (chat_id, user_id) DO NOTHING`,
    [chatId, userId, role],
  );
};

export const getMember = async (
  db: Queryable,
  chatId: string,
  userId: string,
): Promise<MemberEntity | undefined> => {
  const rows = await queryRows(
    db,
    memberEntitySchema,
    `SELECT m.user_id AS "userId", m.role AS "role",
            u.display_name AS "displayName", u.avatar_url AS "avatarUrl"
       FROM chat_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.chat_id = $1 AND m.user_id = $2`,
    [chatId, userId],
  );
  const [row] = rows;
  return row;
};

export const listMembers = (
  db: Queryable,
  chatId: string,
): Promise<MemberEntity[]> =>
  queryRows(
    db,
    memberEntitySchema,
    `SELECT m.user_id       AS "userId",
            m.role          AS "role",
            u.display_name  AS "displayName",
            u.avatar_url    AS "avatarUrl"
       FROM chat_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.chat_id = $1
      ORDER BY m.joined_at ASC`,
    [chatId],
  );
