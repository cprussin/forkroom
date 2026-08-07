import type { BranchEntity } from "../contracts/chat-entities";

export type BranchGraphNode = {
  branchId: string;
  ownerUserId: string;
  isMain: boolean;
  /** Horizontal position: the trunk sits in lane 0, each fork one lane
   * further out, nested forks further still. */
  lane: number;
  /** Vertical position: the row this branch occupies in the drawn graph. */
  row: number;
};

export type BranchGraphEdge = {
  /** The branch a fork sprang from. */
  fromBranchId: string;
  /** The fork itself. */
  toBranchId: string;
};

export type BranchGraph = {
  nodes: BranchGraphNode[];
  edges: BranchGraphEdge[];
  /** How many lanes the graph spans, so the caller can size the drawing. */
  laneCount: number;
};

const byCreation = (a: BranchEntity, b: BranchEntity): number =>
  a.createdAt.localeCompare(b.createdAt);

type Placed = { branch: BranchEntity; depth: number };

/**
 * Lay a chat's branches out as a git-style graph: the trunk in lane 0 at the
 * top, every fork drawn one lane further out and below the branch it forked
 * from, nested forks further out again. Rows follow depth-first display order
 * (siblings by creation time); lanes follow nesting depth. Edges connect each
 * fork to its parent so the caller can draw the connectors.
 */
export const layoutBranchGraph = (
  branches: readonly BranchEntity[],
): BranchGraph => {
  const childrenByParent = new Map<string, BranchEntity[]>();
  const roots: BranchEntity[] = [];
  for (const branch of branches) {
    if (branch.parentBranchId === undefined) {
      roots.push(branch);
    } else {
      const siblings = childrenByParent.get(branch.parentBranchId) ?? [];
      childrenByParent.set(branch.parentBranchId, [...siblings, branch]);
    }
  }
  const walk = (branch: BranchEntity, depth: number): Placed[] => {
    const children = [...(childrenByParent.get(branch.id) ?? [])].sort(
      byCreation,
    );
    return [
      { branch, depth },
      ...children.flatMap((child) => walk(child, depth + 1)),
    ];
  };
  const ordered = [...roots].sort(byCreation).flatMap((root) => walk(root, 0));
  const nodes = ordered.map(({ branch, depth }, index) => ({
    branchId: branch.id,
    isMain: branch.isMain,
    lane: depth,
    ownerUserId: branch.ownerUserId,
    row: index,
  }));
  const present = new Set(nodes.map((node) => node.branchId));
  const edges = branches.flatMap((branch) =>
    branch.parentBranchId !== undefined && present.has(branch.parentBranchId)
      ? [{ fromBranchId: branch.parentBranchId, toBranchId: branch.id }]
      : [],
  );
  const laneCount = nodes.reduce(
    (max, node) => Math.max(max, node.lane + 1),
    0,
  );
  return { edges, laneCount, nodes };
};

/** Whether the graph contains any fork (i.e. more than a lone trunk). */
export const branchGraphHasForks = (graph: BranchGraph): boolean =>
  graph.nodes.some((node) => !node.isMain);
