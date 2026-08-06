import { describe, expect, it } from "bun:test";
import { computeComposerMode } from "./composer-mode";

describe("computeComposerMode", () => {
  it("tells the creator they are replying on main", () => {
    expect(
      computeComposerMode({
        forkFromLabel: "Main",
        isCreator: true,
        ownsSelectedBranch: true,
        selectedIsMain: true,
      }),
    ).toStrictEqual({
      label: "Replying on Main.",
      status: "ready",
      willFork: false,
    });
  });

  it("blocks the creator on a non-main branch", () => {
    expect(
      computeComposerMode({
        forkFromLabel: "Alice",
        isCreator: true,
        ownsSelectedBranch: false,
        selectedIsMain: false,
      }).status,
    ).toBe("blocked");
  });

  it("warns a participant that submitting will fork", () => {
    const mode = computeComposerMode({
      forkFromLabel: "Alice's branch",
      isCreator: false,
      ownsSelectedBranch: false,
      selectedIsMain: false,
    });
    expect(mode.willFork).toBe(true);
    expect(mode.label).toContain("Alice's branch");
  });

  it("tells a branch owner they are continuing their branch", () => {
    expect(
      computeComposerMode({
        forkFromLabel: "you",
        isCreator: false,
        ownsSelectedBranch: true,
        selectedIsMain: false,
      }),
    ).toStrictEqual({
      label: "Continuing your branch.",
      status: "ready",
      willFork: false,
    });
  });
});
