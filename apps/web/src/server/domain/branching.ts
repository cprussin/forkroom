/**
 * The two possible resolutions of a prompt submission. The submit transaction
 * turns `Append` / `Fork` into concrete row writes.
 */
export enum SubmissionOutcome {
  /** Append the prompt to the selected branch (the submitter owns it). */
  Append = 0,
  /** Create a child branch: the submitter does not own the branch, or asked to
   * fork from an earlier point in history. */
  Fork = 1,
}

export type AppendVsForkInput = {
  /** The submitting user owns the branch their composer is scoped to. */
  ownsSelectedBranch: boolean;
  /** The submission names an explicit fork point in history rather than the
   * tip of the owned branch. */
  explicitForkRequested: boolean;
};

/**
 * Decide whether a submission appends to the selected branch or forks a new
 * child. Assumes membership and branch-tip validity are checked elsewhere.
 *
 *   - You append to a branch you own (extending it).
 *   - You fork from any branch you do not own, and from any explicit point in
 *     history you name — even on a branch you own.
 */
export const appendVsFork = (input: AppendVsForkInput): SubmissionOutcome =>
  input.ownsSelectedBranch && !input.explicitForkRequested
    ? SubmissionOutcome.Append
    : SubmissionOutcome.Fork;
