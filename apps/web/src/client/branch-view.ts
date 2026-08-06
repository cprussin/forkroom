import type { MessageEntity } from "../contracts/chat-entities";
import { buildBranchContext } from "../server/domain/context";
import type { ChatState } from "./chat-reducer";
import { messagesForBranch } from "./chat-reducer";

export type BranchView = {
  inherited: MessageEntity[];
  local: MessageEntity[];
};

/**
 * Split a branch's rendered messages into the inherited ancestor prefix (up to
 * its fork point) and its own local messages. The inherited prefix reuses the
 * same ancestry walk the server uses to build model context, so what the user
 * sees and what the model receives are derived identically.
 */
export const selectBranchView = (
  state: ChatState,
  branchId: string,
): BranchView => {
  const branch = state.branches[branchId];
  const local = messagesForBranch(state, branchId);
  if (
    branch === undefined ||
    branch.parentBranchId === undefined ||
    branch.forkMessageId === undefined
  ) {
    return { inherited: [], local };
  } else {
    const context = buildBranchContext({
      branches: Object.values(state.branches).map((b) => ({
        forkMessageId: b.forkMessageId,
        id: b.id,
        parentBranchId: b.parentBranchId,
      })),
      branchId: branch.parentBranchId,
      messages: Object.values(state.messages).map((m) => ({
        branchId: m.branchId,
        content: m.content,
        id: m.id,
        role: m.role,
        sequenceNumber: m.sequenceNumber,
        status: m.status,
      })),
      targetMessageId: branch.forkMessageId,
    });
    const inherited = context
      .map((m) => state.messages[m.id])
      .filter((m): m is MessageEntity => m !== undefined);
    return { inherited, local };
  }
};
