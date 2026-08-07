import { describe, expect, it } from "bun:test";
import { computeComposerMode } from "./composer-mode";

describe("computeComposerMode", () => {
  it("continues the chat when the user owns the branch", () => {
    expect(
      computeComposerMode({
        explicitFork: false,
        forkFromLabel: "Main",
        ownsSelectedBranch: true,
      }),
    ).toStrictEqual({
      label: "Continuing this chat.",
      willFork: false,
    });
  });

  it("warns that submitting on someone else's branch will fork", () => {
    const mode = computeComposerMode({
      explicitFork: false,
      forkFromLabel: "Alice's fork",
      ownsSelectedBranch: false,
    });
    expect(mode.willFork).toBe(true);
    expect(mode.label).toContain("Alice's fork");
  });

  it("warns that an explicit fork point will fork, even on an owned branch", () => {
    const mode = computeComposerMode({
      explicitFork: true,
      forkFromLabel: "Main",
      ownsSelectedBranch: true,
    });
    expect(mode.willFork).toBe(true);
    expect(mode.label).toContain("here");
  });
});
