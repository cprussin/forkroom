import type { BranchEntity } from "../contracts/chat-entities";

export type BranchTreeNode = {
  branchId: string;
  ownerUserId: string;
  isMain: boolean;
  /** Nesting level: 0 for the trunk, +1 for each fork-of-a-fork below it. */
  depth: number;
};

const byCreation = (a: BranchEntity, b: BranchEntity): number =>
  a.createdAt.localeCompare(b.createdAt);

/**
 * Flatten a chat's branches into depth-first display order: the trunk first,
 * then every fork nested under the branch it forked from, siblings ordered by
 * creation time. Each node carries its nesting `depth` so the UI can indent
 * fork-of-a-fork chains and convey the whole hierarchy at once.
 */
export const buildBranchTree = (
  branches: readonly BranchEntity[],
): BranchTreeNode[] => {
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
  const walk = (branch: BranchEntity, depth: number): BranchTreeNode[] => {
    const children = [...(childrenByParent.get(branch.id) ?? [])].sort(
      byCreation,
    );
    return [
      {
        branchId: branch.id,
        depth,
        isMain: branch.isMain,
        ownerUserId: branch.ownerUserId,
      },
      ...children.flatMap((child) => walk(child, depth + 1)),
    ];
  };
  return [...roots].sort(byCreation).flatMap((root) => walk(root, 0));
};

/** The forks (every non-trunk branch) among a set of tree nodes. */
export const forkNodes = (nodes: readonly BranchTreeNode[]): BranchTreeNode[] =>
  nodes.filter((node) => !node.isMain);
