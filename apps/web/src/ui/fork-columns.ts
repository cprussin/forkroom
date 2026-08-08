/** A fork variant and whether it has any messages past the fork point. */
type Variant = {
  branchId: string;
  hasContent: boolean;
};

export type ForkColumnPlan = {
  /** Branches that become columns, in variant order — only those with content. */
  branchIds: string[];
  /** The column to centre in the carousel. */
  centredBranchId: string;
};

/**
 * Decide the carousel's columns for a fork. Only continuations that actually
 * have messages become columns: a branch with nothing past the fork (e.g. the
 * trunk when the thread was forked from its own tip) would otherwise render as
 * a blank column and, sitting at the start of the row, push the real
 * continuations off the visible edge — reading as "the fork didn't render".
 *
 * The centred column is the followed branch when it is one of the columns,
 * otherwise the first column, so a real continuation is always on screen even
 * before the carousel's centring effect runs. Returns `undefined` when no
 * variant has a continuation to show (nothing to render past the fork).
 */
export const planForkColumns = (
  followedBranchId: string,
  variants: Variant[],
): ForkColumnPlan | undefined => {
  const withContent = variants.filter((variant) => variant.hasContent);
  const first = withContent[0];
  if (first === undefined) {
    return undefined;
  }
  const followed = withContent.find(
    (variant) => variant.branchId === followedBranchId,
  );
  return {
    branchIds: withContent.map((variant) => variant.branchId),
    centredBranchId: (followed ?? first).branchId,
  };
};
