/**
 * The three possible resolutions of a prompt submission, decided purely from
 * who is submitting and which branch their composer is scoped to. The submit
 * transaction turns `Append` / `Fork` into concrete row writes; the API turns
 * `CreatorMustReturnToMain` into a rejection.
 */
export enum SubmissionOutcome {
  /** Append the prompt to the selected branch (creator on main, or owner). */
  Append = 0,
  /** Create a child branch from the selected tip (participant, not owner). */
  Fork = 1,
  /** The creator is viewing a non-main branch; the MVP forbids composing. */
  CreatorMustReturnToMain = 2,
}

export type AppendVsForkInput = {
  /** The submitting user is the chat's creator. */
  isCreator: boolean;
  /** The submitting user owns the branch their composer is scoped to. */
  ownsSelectedBranch: boolean;
  /** The selected branch is the chat's main branch. */
  selectedIsMain: boolean;
};

/**
 * Decide whether a submission appends to the selected branch, forks a new
 * child, or is rejected. Assumes membership and branch-tip validity are checked
 * elsewhere — this is only the append-vs-fork rule from the PRD:
 *
 *   - The creator may only compose on main (append); composing elsewhere is
 *     rejected.
 *   - A participant appends to a branch they own and forks from any branch they
 *     do not (main included, since the creator owns main).
 */
export const appendVsFork = (input: AppendVsForkInput): SubmissionOutcome => {
  if (input.isCreator) {
    return input.selectedIsMain
      ? SubmissionOutcome.Append
      : SubmissionOutcome.CreatorMustReturnToMain;
  } else {
    return input.ownsSelectedBranch
      ? SubmissionOutcome.Append
      : SubmissionOutcome.Fork;
  }
};
