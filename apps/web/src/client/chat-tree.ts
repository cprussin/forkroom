import type { MessageEntity } from "../contracts/chat-entities";

type TreeMessage = Pick<
  MessageEntity,
  "authorUserId" | "branchId" | "id" | "role" | "sequenceNumber"
>;

type TreeBranch = {
  id: string;
  forkMessageId?: string | undefined;
  createdAt: string;
};

export type ChatTreeNode = {
  messageId: string;
  branchId: string;
  role: MessageEntity["role"];
  authorUserId: string | undefined;
  /** Horizontal slot; parents sit centred over their children's span. */
  column: number;
  /** Vertical level, 0 at the first message. */
  depth: number;
};

export type ChatTreeEdge = {
  fromMessageId: string;
  toMessageId: string;
};

export type ChatTree = {
  nodes: ChatTreeNode[];
  edges: ChatTreeEdge[];
  /** The largest column any node occupies, for sizing the drawing. */
  maxColumn: number;
  /** The deepest level any node occupies. */
  maxDepth: number;
};

/**
 * Build the whole conversation as a tree of messages — every message a node,
 * assistant replies included. A message's parent is the message before it on
 * its own branch, or, for a branch's first message, the message it forked from;
 * so a message that was forked has several children (its own continuation plus
 * each fork) laid out as horizontal siblings. Columns place parents centred
 * over their children; depth is the level from the first message.
 */
export const buildChatTree = (
  messages: readonly TreeMessage[],
  branches: readonly TreeBranch[],
): ChatTree => {
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const localByBranch = groupByBranch(messages);
  const forkMessageByBranch = new Map(
    branches.map((branch) => [branch.id, branch.forkMessageId]),
  );
  const createdAtByBranch = new Map(
    branches.map((branch) => [branch.id, branch.createdAt]),
  );

  const parentIdOf = (message: TreeMessage): string | undefined => {
    const local = localByBranch.get(message.branchId) ?? [];
    const index = local.findIndex((sibling) => sibling.id === message.id);
    return index > 0
      ? local[index - 1]?.id
      : forkMessageByBranch.get(message.branchId);
  };

  const childrenByParent = new Map<string, TreeMessage[]>();
  const roots: TreeMessage[] = [];
  for (const message of messages) {
    const parentId = parentIdOf(message);
    if (parentId === undefined || !messageById.has(parentId)) {
      roots.push(message);
    } else {
      const siblings = childrenByParent.get(parentId) ?? [];
      childrenByParent.set(parentId, [...siblings, message]);
    }
  }

  const orderChildren = (
    parentBranchId: string,
    children: readonly TreeMessage[],
  ): TreeMessage[] =>
    [...children].sort((a, b) => {
      const continuation =
        Number(a.branchId !== parentBranchId) -
        Number(b.branchId !== parentBranchId);
      if (continuation === 0) {
        const byBranch = (
          createdAtByBranch.get(a.branchId) ?? ""
        ).localeCompare(createdAtByBranch.get(b.branchId) ?? "");
        return byBranch === 0 ? a.sequenceNumber - b.sequenceNumber : byBranch;
      } else {
        return continuation;
      }
    });

  let nextLeafColumn = 0;
  const place = (
    message: TreeMessage,
    depth: number,
  ): { column: number; nodes: ChatTreeNode[] } => {
    const children = orderChildren(
      message.branchId,
      childrenByParent.get(message.id) ?? [],
    );
    if (children.length === 0) {
      const column = nextLeafColumn;
      nextLeafColumn += 1;
      return { column, nodes: [toNode(message, column, depth)] };
    } else {
      const placed = children.map((child) => place(child, depth + 1));
      const first = placed[0];
      const last = placed.at(-1);
      const column =
        first === undefined || last === undefined
          ? nextLeafColumn
          : (first.column + last.column) / 2;
      return {
        column,
        nodes: [
          toNode(message, column, depth),
          ...placed.flatMap((entry) => entry.nodes),
        ],
      };
    }
  };

  const nodes = orderByCreation(roots, createdAtByBranch).flatMap(
    (root) => place(root, 0).nodes,
  );
  const edges = [...childrenByParent].flatMap(([fromMessageId, children]) =>
    children.map((child) => ({ fromMessageId, toMessageId: child.id })),
  );
  const maxColumn = nodes.reduce((max, node) => Math.max(max, node.column), 0);
  const maxDepth = nodes.reduce((max, node) => Math.max(max, node.depth), 0);
  return { edges, maxColumn, maxDepth, nodes };
};

const toNode = (
  message: TreeMessage,
  column: number,
  depth: number,
): ChatTreeNode => ({
  authorUserId: message.authorUserId,
  branchId: message.branchId,
  column,
  depth,
  messageId: message.id,
  role: message.role,
});

const groupByBranch = (
  messages: readonly TreeMessage[],
): Map<string, TreeMessage[]> => {
  const grouped = new Map<string, TreeMessage[]>();
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

const orderByCreation = (
  messages: readonly TreeMessage[],
  createdAtByBranch: ReadonlyMap<string, string>,
): TreeMessage[] =>
  [...messages].sort((a, b) =>
    (createdAtByBranch.get(a.branchId) ?? "").localeCompare(
      createdAtByBranch.get(b.branchId) ?? "",
    ),
  );

/** Whether a chat has any fork — i.e. the tree is worth drawing at all. */
export const chatHasForks = (
  branches: readonly { isMain: boolean }[],
): boolean => branches.some((branch) => !branch.isMain);
