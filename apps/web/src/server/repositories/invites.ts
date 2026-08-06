import { z } from "zod";
import { execute, queryRows } from "../db/client";
import type { Queryable } from "../db/pool";

export type NewInvite = {
  id: string;
  chatId: string;
  createdByUserId: string;
  tokenHash: string;
  expiresAt: Date | undefined;
  maxUses: number | undefined;
};

export const insertInvite = async (
  db: Queryable,
  invite: NewInvite,
): Promise<void> => {
  await execute(
    db,
    `INSERT INTO chat_invites
       (id, chat_id, created_by_user_id, token_hash, expires_at, max_uses)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      invite.id,
      invite.chatId,
      invite.createdByUserId,
      invite.tokenHash,
      invite.expiresAt ?? null,
      invite.maxUses ?? null,
    ],
  );
};

const inviteRowSchema = z.object({
  chatId: z.string(),
  expiresAt: z.date().nullable(),
  id: z.string(),
  maxUses: z.number().nullable(),
  revokedAt: z.date().nullable(),
  useCount: z.number(),
});
export type InviteRow = z.infer<typeof inviteRowSchema>;

const INVITE_COLUMNS = `
  id           AS "id",
  chat_id      AS "chatId",
  expires_at   AS "expiresAt",
  revoked_at   AS "revokedAt",
  max_uses     AS "maxUses",
  use_count    AS "useCount"
`;

export const getInviteByHash = async (
  db: Queryable,
  tokenHash: string,
): Promise<InviteRow | undefined> => {
  const rows = await queryRows(
    db,
    inviteRowSchema,
    `SELECT ${INVITE_COLUMNS} FROM chat_invites WHERE token_hash = $1`,
    [tokenHash],
  );
  const [row] = rows;
  return row;
};

/** Increment an invite's use count, guarding the max-uses ceiling atomically. */
export const incrementInviteUse = async (
  db: Queryable,
  inviteId: string,
): Promise<void> => {
  await execute(
    db,
    `UPDATE chat_invites
        SET use_count = use_count + 1
      WHERE id = $1
        AND (max_uses IS NULL OR use_count < max_uses)`,
    [inviteId],
  );
};

export const revokeInvite = async (
  db: Queryable,
  chatId: string,
  inviteId: string,
): Promise<number> =>
  execute(
    db,
    "UPDATE chat_invites SET revoked_at = now() WHERE id = $1 AND chat_id = $2 AND revoked_at IS NULL",
    [inviteId, chatId],
  );

export const appendAuditEntry = async (
  db: Queryable,
  entry: {
    chatId: string;
    actorUserId: string;
    action: string;
    targetId: string | undefined;
    detail?: Record<string, unknown>;
  },
): Promise<void> => {
  await execute(
    db,
    `INSERT INTO audit_log (chat_id, actor_user_id, action, target_id, detail)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      entry.chatId,
      entry.actorUserId,
      entry.action,
      entry.targetId ?? null,
      JSON.stringify(entry.detail ?? {}),
    ],
  );
};
