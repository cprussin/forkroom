import { z } from "zod";
import type { BranchEntity } from "../../contracts/chat-entities";
import { branchEntitySchema } from "../../contracts/chat-entities";
import { queryOne, queryRows } from "../db/client";
import type { Queryable } from "../db/pool";

const BRANCH_COLUMNS = `
  id                   AS "id",
  chat_id              AS "chatId",
  parent_branch_id     AS "parentBranchId",
  fork_message_id      AS "forkMessageId",
  owner_user_id        AS "ownerUserId",
  created_by_user_id   AS "createdByUserId",
  created_at           AS "createdAt",
  (parent_branch_id IS NULL) AS "isMain"
`;

export type NewBranch = {
  id: string;
  chatId: string;
  parentBranchId: string | undefined;
  forkMessageId: string | undefined;
  ownerUserId: string;
  createdByUserId: string;
};

export const insertBranch = (
  db: Queryable,
  branch: NewBranch,
): Promise<BranchEntity> =>
  queryOne(
    db,
    branchEntitySchema,
    `INSERT INTO branches
       (id, chat_id, parent_branch_id, fork_message_id, owner_user_id, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${BRANCH_COLUMNS}`,
    [
      branch.id,
      branch.chatId,
      branch.parentBranchId ?? null,
      branch.forkMessageId ?? null,
      branch.ownerUserId,
      branch.createdByUserId,
    ],
  );

/**
 * Load a branch scoped to its chat, taking a row lock when `forUpdate` is set so
 * concurrent submissions to the same branch serialize on the branch row.
 */
export const getBranch = async (
  db: Queryable,
  chatId: string,
  branchId: string,
  forUpdate = false,
): Promise<BranchEntity | undefined> => {
  const rows = await queryRows(
    db,
    branchEntitySchema,
    `SELECT ${BRANCH_COLUMNS}
       FROM branches
      WHERE chat_id = $1 AND id = $2
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [chatId, branchId],
  );
  const [row] = rows;
  return row;
};

export const listBranches = (
  db: Queryable,
  chatId: string,
): Promise<BranchEntity[]> =>
  queryRows(
    db,
    branchEntitySchema,
    `SELECT ${BRANCH_COLUMNS} FROM branches WHERE chat_id = $1 ORDER BY created_at ASC`,
    [chatId],
  );

const tipRowSchema = z.object({
  tipMessageId: z.string().nullable(),
});

/**
 * The current tip of a branch: its last local message, or its fork-point
 * message when it has no local messages yet (`undefined` for an empty history).
 */
export const getBranchTip = async (
  db: Queryable,
  chatId: string,
  branchId: string,
): Promise<string | undefined> => {
  const row = await queryOne(
    db,
    tipRowSchema,
    `SELECT COALESCE(
              (SELECT id FROM messages
                WHERE branch_id = $2
                ORDER BY sequence_number DESC
                LIMIT 1),
              (SELECT fork_message_id FROM branches WHERE id = $2 AND chat_id = $1)
            ) AS "tipMessageId"`,
    [chatId, branchId],
  );
  return row.tipMessageId ?? undefined;
};
