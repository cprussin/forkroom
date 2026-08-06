/**
 * Deterministic construction of a branch's conversation context by walking
 * branch ancestry. Messages are stored per-branch (only local messages); the
 * inherited prefix is reconstructed here, never duplicated in storage.
 *
 * The context for a branch up to a target message is:
 *
 *   context(branch, target) =
 *     inheritedPrefix(branch) ++ localMessages(branch, ≤ target)   (target local)
 *     context(parent, target)                                      (target in ancestor)
 *
 * where `inheritedPrefix(branch)` is `context(parent, forkMessage)` — the
 * parent's visible history up to the fork point — or empty when the branch
 * forked from an empty history (the main branch, or a fork with no fork
 * message).
 */

export type ContextBranch = {
  id: string;
  parentBranchId: string | undefined;
  forkMessageId: string | undefined;
};

export type ContextMessage = {
  id: string;
  branchId: string;
  sequenceNumber: number;
  role: "user" | "assistant" | "system";
  content: string;
  status: "completed" | "queued" | "streaming" | "failed";
};

export type BuildContextInput = {
  branches: readonly ContextBranch[];
  messages: readonly ContextMessage[];
  branchId: string;
  /**
   * The tip to build context up to. When `undefined`, the whole branch (all its
   * local messages) plus its inherited prefix is returned.
   */
  targetMessageId: string | undefined;
};

/**
 * Build the ordered list of messages visible on `branchId` up to
 * `targetMessageId` — the ancestor prefix followed by this branch's local
 * messages in `sequence_number` order.
 */
export const buildBranchContext = (
  input: BuildContextInput,
): ContextMessage[] => {
  const branchById = new Map(input.branches.map((b) => [b.id, b]));
  const messageById = new Map(input.messages.map((m) => [m.id, m]));
  const localByBranch = groupLocalMessages(input.messages);

  const walk = (
    branchId: string,
    targetMessageId: string | undefined,
  ): ContextMessage[] => {
    const branch = branchById.get(branchId);
    if (branch === undefined) {
      throw new Error(`unknown branch ${branchId} in context construction`);
    } else {
      const target =
        targetMessageId === undefined
          ? undefined
          : lookupMessage(messageById, targetMessageId);

      if (target !== undefined && target.branchId !== branchId) {
        return walk(requireParent(branch), targetMessageId);
      } else {
        const prefix =
          branch.forkMessageId === undefined
            ? []
            : walk(requireParent(branch), branch.forkMessageId);
        const locals = localByBranch.get(branchId) ?? [];
        const bounded =
          target === undefined
            ? locals
            : locals.filter((m) => m.sequenceNumber <= target.sequenceNumber);
        return [...prefix, ...bounded];
      }
    }
  };

  return walk(input.branchId, input.targetMessageId);
};

const groupLocalMessages = (
  messages: readonly ContextMessage[],
): Map<string, ContextMessage[]> => {
  const grouped = new Map<string, ContextMessage[]>();
  for (const message of messages) {
    const existing = grouped.get(message.branchId) ?? [];
    grouped.set(message.branchId, [...existing, message]);
  }
  return new Map(
    [...grouped].map(([branchId, list]) => [
      branchId,
      [...list].sort((a, b) => a.sequenceNumber - b.sequenceNumber),
    ]),
  );
};

const lookupMessage = (
  messageById: Map<string, ContextMessage>,
  id: string,
): ContextMessage => {
  const message = messageById.get(id);
  if (message === undefined) {
    throw new Error(`unknown target message ${id} in context construction`);
  } else {
    return message;
  }
};

const requireParent = (branch: ContextBranch): string => {
  if (branch.parentBranchId === undefined) {
    throw new Error(
      `branch ${branch.id} has no parent but context walk needs one`,
    );
  } else {
    return branch.parentBranchId;
  }
};
