import type { BranchEntity, MessageEntity } from "../contracts/chat-entities";
import { buildBranchContext } from "../server/domain/context";
import type { ChatState } from "./chat-reducer";

export type ForkVariant = {
  /** Branch to select as the new leaf when this variant is chosen. */
  branchId: string;
  ownerUserId: string;
  isMain: boolean;
};

export type ForkSwitch = {
  /** The trunk (the branch this message lives on) first, then forks by
   * creation time. */
  variants: ForkVariant[];
  /** Which variant the currently-displayed thread follows past this message. */
  activeBranchId: string;
};

export type ThreadEntry = {
  message: MessageEntity;
  /** Present when at least one fork springs from this message. */
  fork: ForkSwitch | undefined;
};

/**
 * Flatten a chat into the linear thread shown for a selected leaf branch — the
 * ancestor prefix up to the leaf's fork points, then the leaf's own messages —
 * and, on each message that was forked, the set of branches that continue from
 * it so the UI can switch between them (ChatGPT-style variant navigation).
 */
export const buildThreadView = (
  state: ChatState,
  leafBranchId: string,
): ThreadEntry[] => {
  const leaf = state.branches[leafBranchId];
  if (leaf === undefined) {
    return [];
  } else {
    const path = pathMessages(state, leafBranchId);
    const forksByMessage = groupForks(Object.values(state.branches));
    return path.map((message, index) => ({
      fork: forkSwitchFor(state, message, path[index + 1], forksByMessage),
      message,
    }));
  }
};

/** The ordered messages visible on the leaf, ancestor prefix included. */
const pathMessages = (
  state: ChatState,
  leafBranchId: string,
): MessageEntity[] => {
  const branches = Object.values(state.branches).map((b) => ({
    forkMessageId: b.forkMessageId,
    id: b.id,
    parentBranchId: b.parentBranchId,
  }));
  const messages = Object.values(state.messages).map((m) => ({
    branchId: m.branchId,
    content: m.content,
    id: m.id,
    role: m.role,
    sequenceNumber: m.sequenceNumber,
    status: m.status,
  }));
  return buildBranchContext({
    branches,
    branchId: leafBranchId,
    messages,
    targetMessageId: undefined,
  })
    .map((m) => state.messages[m.id])
    .filter((m): m is MessageEntity => m !== undefined);
};

/** Child branches keyed by the message they forked from, in creation order. */
const groupForks = (branches: BranchEntity[]): Map<string, BranchEntity[]> => {
  const grouped = new Map<string, BranchEntity[]>();
  for (const branch of branches) {
    if (branch.forkMessageId !== undefined) {
      const existing = grouped.get(branch.forkMessageId) ?? [];
      grouped.set(branch.forkMessageId, [...existing, branch]);
    }
  }
  return new Map(
    [...grouped].map(([messageId, list]) => [
      messageId,
      [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    ]),
  );
};

const forkSwitchFor = (
  state: ChatState,
  message: MessageEntity,
  next: MessageEntity | undefined,
  forksByMessage: Map<string, BranchEntity[]>,
): ForkSwitch | undefined => {
  const forks = forksByMessage.get(message.id) ?? [];
  const trunk = state.branches[message.branchId];
  if (forks.length === 0 || trunk === undefined) {
    return undefined;
  } else {
    const variants = [trunk, ...forks].map((branch) => ({
      branchId: branch.id,
      isMain: branch.isMain,
      ownerUserId: branch.ownerUserId,
    }));
    const activeBranchId =
      next !== undefined && next.branchId !== message.branchId
        ? next.branchId
        : message.branchId;
    return { activeBranchId, variants };
  }
};
