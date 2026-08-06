import type { ChatSnapshot } from "../../contracts/chat-snapshot";
import type { Queryable } from "../db/pool";
import type { Role } from "../domain/roles";
import { roleToWire } from "../domain/roles";
import { listBranches } from "./branches";
import { getChatMeta } from "./chats";
import { listGenerations } from "./generations";
import { listMembers } from "./members";
import { listMessages } from "./messages";
import { currentCursor } from "./outbox";

/**
 * Assemble the normalized snapshot for a chat and the requesting member. The
 * cursor is read last so any event whose write committed before this snapshot
 * is either included in the data or resumable from the cursor — never lost
 * between load and subscribe.
 */
export const getChatSnapshot = async (
  db: Queryable,
  chatId: string,
  currentUserId: string,
  currentUserRole: Role,
): Promise<ChatSnapshot | undefined> => {
  const chat = await getChatMeta(db, chatId);
  if (chat === undefined) {
    return undefined;
  } else {
    const [members, branches, messages, generations, cursor] =
      await Promise.all([
        listMembers(db, chatId),
        listBranches(db, chatId),
        listMessages(db, chatId),
        listGenerations(db, chatId),
        currentCursor(db, chatId),
      ]);
    return {
      branches,
      chat: {
        createdAt: chat.createdAt,
        creatorUserId: chat.creatorUserId,
        id: chat.id,
        mainBranchId: chat.mainBranchId,
        title: chat.title,
      },
      currentUserId,
      currentUserRole: roleToWire(currentUserRole),
      cursor,
      generations,
      members,
      messages,
    };
  }
};
