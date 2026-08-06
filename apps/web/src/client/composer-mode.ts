import { appendVsFork, SubmissionOutcome } from "../server/domain/branching";

export type ComposerMode = {
  status: "ready" | "blocked";
  willFork: boolean;
  label: string;
};

export type ComposerModeInput = {
  isCreator: boolean;
  ownsSelectedBranch: boolean;
  selectedIsMain: boolean;
  /** Human label for the branch a fork would spring from (e.g. an owner name). */
  forkFromLabel: string;
};

/**
 * The composer's pre-submission state and message, mirroring the server's
 * append-vs-fork rule so the UI states the outcome before the user sends
 * (PRD §6.1). This is presentation only; the server re-derives and enforces the
 * same decision.
 */
export const computeComposerMode = (input: ComposerModeInput): ComposerMode => {
  const outcome = appendVsFork({
    isCreator: input.isCreator,
    ownsSelectedBranch: input.ownsSelectedBranch,
    selectedIsMain: input.selectedIsMain,
  });
  switch (outcome) {
    case SubmissionOutcome.Append: {
      return {
        label: input.selectedIsMain
          ? "Replying on Main."
          : "Continuing your branch.",
        status: "ready",
        willFork: false,
      };
    }
    case SubmissionOutcome.Fork: {
      return {
        label: `Your message will start a new branch from ${input.forkFromLabel}.`,
        status: "ready",
        willFork: true,
      };
    }
    case SubmissionOutcome.CreatorMustReturnToMain: {
      return {
        label: "Return to the Main branch to compose.",
        status: "blocked",
        willFork: false,
      };
    }
  }
};
