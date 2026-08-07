import { describe, expect, it } from "bun:test";
import {
  appendVsFork,
  isForkableMessage,
  SubmissionOutcome,
} from "./branching";

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

describe("isForkableMessage", () => {
  it("allows forking from a completed assistant reply", () => {
    expect(isForkableMessage({ role: "assistant", status: "completed" })).toBe(
      true,
    );
  });

  it("rejects forking from a user message", () => {
    expect(isForkableMessage({ role: "user", status: "completed" })).toBe(
      false,
    );
  });

  it("rejects forking from a system message", () => {
    expect(isForkableMessage({ role: "system", status: "completed" })).toBe(
      false,
    );
  });

  it("rejects forking from an assistant reply that has not completed", () => {
    expect(isForkableMessage({ role: "assistant", status: "streaming" })).toBe(
      false,
    );
  });
});
