import { describe, expect, it } from "bun:test";
import { appendVsFork, SubmissionOutcome } from "./branching";

describe("appendVsFork", () => {
  it("appends when the submitter owns the selected branch", () => {
    expect(
      appendVsFork({
        explicitForkRequested: false,
        ownsSelectedBranch: true,
      }),
    ).toBe(SubmissionOutcome.Append);
  });

  it("forks when the submitter does not own the selected branch", () => {
    expect(
      appendVsFork({
        explicitForkRequested: false,
        ownsSelectedBranch: false,
      }),
    ).toBe(SubmissionOutcome.Fork);
  });

  it("forks from an owned branch when a fork point is explicitly requested", () => {
    expect(
      appendVsFork({
        explicitForkRequested: true,
        ownsSelectedBranch: true,
      }),
    ).toBe(SubmissionOutcome.Fork);
  });
});
