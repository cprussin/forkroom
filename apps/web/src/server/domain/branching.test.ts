import { describe, expect, it } from "bun:test";
import { appendVsFork, SubmissionOutcome } from "./branching";

describe("appendVsFork", () => {
  describe("creator", () => {
    it("appends when the creator composes on the main branch", () => {
      expect(
        appendVsFork({
          isCreator: true,
          ownsSelectedBranch: true,
          selectedIsMain: true,
        }),
      ).toBe(SubmissionOutcome.Append);
    });

    it("blocks the creator from composing on a non-main branch", () => {
      expect(
        appendVsFork({
          isCreator: true,
          ownsSelectedBranch: false,
          selectedIsMain: false,
        }),
      ).toBe(SubmissionOutcome.CreatorMustReturnToMain);
    });
  });

  describe("participant", () => {
    it("forks when submitting from the main branch (never owned by a participant)", () => {
      expect(
        appendVsFork({
          isCreator: false,
          ownsSelectedBranch: false,
          selectedIsMain: true,
        }),
      ).toBe(SubmissionOutcome.Fork);
    });

    it("appends when continuing its own branch", () => {
      expect(
        appendVsFork({
          isCreator: false,
          ownsSelectedBranch: true,
          selectedIsMain: false,
        }),
      ).toBe(SubmissionOutcome.Append);
    });

    it("forks when submitting from another user's branch", () => {
      expect(
        appendVsFork({
          isCreator: false,
          ownsSelectedBranch: false,
          selectedIsMain: false,
        }),
      ).toBe(SubmissionOutcome.Fork);
    });
  });
});
