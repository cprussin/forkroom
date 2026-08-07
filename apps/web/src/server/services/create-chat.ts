import { withTransaction } from "../db/client";
import { getPool } from "../db/pool";
import type { IdGenerator } from "../domain/ids";
import { newId as defaultNewId } from "../domain/ids";
import { insertBranch } from "../repositories/branches";
import { insertChat, setMainBranch } from "../repositories/chats";
import { insertMember } from "../repositories/members";

export type CreateChatResult = { chatId: string; mainBranchId: string };

/**
 * Create a chat atomically: the chat row, its creator membership, and its empty
 * main branch all commit together, and `main_branch_id` is assigned within the
 * same transaction (PRD §7.2). Fails loudly if any step throws — no partial
 * chat is ever left behind.
 */
// Placeholder shown until the first message renames the chat (the sidebar and
// title bar never show an empty name, and the DB requires a non-empty title).
const UNTITLED = "New chat";

export const createChat = (
  input: { userId: string; title?: string | undefined },
  pool = getPool(),
  mint: IdGenerator = defaultNewId,
): Promise<CreateChatResult> =>
  withTransaction(async (tx) => {
    const chatId = mint();
    const mainBranchId = mint();
    await insertChat(tx, {
      creatorUserId: input.userId,
      id: chatId,
      title:
        input.title === undefined || input.title.length === 0
          ? UNTITLED
          : input.title,
    });
    await insertBranch(tx, {
      chatId,
      createdByUserId: input.userId,
      forkMessageId: undefined,
      id: mainBranchId,
      ownerUserId: input.userId,
      parentBranchId: undefined,
    });
    await setMainBranch(tx, chatId, mainBranchId);
    await insertMember(tx, chatId, input.userId, "creator");
    return { chatId, mainBranchId };
  }, pool);
