import { appendVsFork, SubmissionOutcome } from "../server/domain/branching";

export type ComposerMode = {
  willFork: boolean;
  label: string;
};

export type ComposerModeInput = {
  /** The user owns the branch the composer is scoped to. */
  ownsSelectedBranch: boolean;
  /** The composer is aimed at an explicit fork point in history. */
  explicitFork: boolean;
  /** Human label for the branch a tip fork would spring from (e.g. an owner
   * name), used only when the fork is not from an explicit point. */
  forkFromLabel: string;
};

/**
 * The composer's pre-submission state and message, mirroring the server's
 * append-vs-fork rule so the UI states the outcome before the user sends. This
 * is presentation only; the server re-derives and enforces the same decision.
 */
export const computeComposerMode = (input: ComposerModeInput): ComposerMode => {
  const outcome = appendVsFork({
    explicitForkRequested: input.explicitFork,
    ownsSelectedBranch: input.ownsSelectedBranch,
  });
  switch (outcome) {
    case SubmissionOutcome.Append: {
      return { label: "Continuing this chat.", willFork: false };
    }
    case SubmissionOutcome.Fork: {
      return {
        label: input.explicitFork
          ? "Your message will start a new fork from here."
          : `Your message will start a new fork from ${input.forkFromLabel}.`,
        willFork: true,
      };
    }
  }
};
