import { describe, expect, it } from "bun:test";
import type { ContextBranch, ContextMessage } from "./context";
import { buildBranchContext } from "./context";

const msg = (
  id: string,
  branchId: string,
  sequenceNumber: number,
  role: ContextMessage["role"] = "user",
): ContextMessage => ({
  branchId,
  content: id,
  id,
  role,
  sequenceNumber,
  status: "completed",
});

const ids = (messages: ContextMessage[]): string[] => messages.map((m) => m.id);

const MAIN: ContextBranch = {
  forkMessageId: undefined,
  id: "main",
  parentBranchId: undefined,
};

describe("buildBranchContext", () => {
  it("returns the main branch's local messages in sequence order", () => {
    const messages = [
      msg("m1", "main", 1, "user"),
      msg("m2", "main", 2, "assistant"),
      msg("m3", "main", 3, "user"),
    ];
    expect(
      ids(
        buildBranchContext({
          branches: [MAIN],
          branchId: "main",
          messages,
          targetMessageId: "m3",
        }),
      ),
    ).toStrictEqual(["m1", "m2", "m3"]);
  });

  it("returns all local messages when no target is given", () => {
    const messages = [msg("m1", "main", 1), msg("m2", "main", 2)];
    expect(
      ids(
        buildBranchContext({
          branches: [MAIN],
          branchId: "main",
          messages,
          targetMessageId: undefined,
        }),
      ),
    ).toStrictEqual(["m1", "m2"]);
  });

  it("prepends the inherited prefix up to the fork point on a child branch", () => {
    const branchB: ContextBranch = {
      forkMessageId: "m2",
      id: "b",
      parentBranchId: "main",
    };
    const messages = [
      msg("m1", "main", 1),
      msg("m2", "main", 2, "assistant"),
      // m3 came after the fork point and must NOT be inherited by b.
      msg("m3", "main", 3),
      msg("b1", "b", 1),
    ];
    expect(
      ids(
        buildBranchContext({
          branches: [MAIN, branchB],
          branchId: "b",
          messages,
          targetMessageId: "b1",
        }),
      ),
    ).toStrictEqual(["m1", "m2", "b1"]);
  });

  it("leaves the parent branch's own context unchanged", () => {
    const branchB: ContextBranch = {
      forkMessageId: "m2",
      id: "b",
      parentBranchId: "main",
    };
    const messages = [
      msg("m1", "main", 1),
      msg("m2", "main", 2, "assistant"),
      msg("m3", "main", 3),
      msg("b1", "b", 1),
    ];
    expect(
      ids(
        buildBranchContext({
          branches: [MAIN, branchB],
          branchId: "main",
          messages,
          targetMessageId: "m3",
        }),
      ),
    ).toStrictEqual(["m1", "m2", "m3"]);
  });

  it("walks multiple nesting levels", () => {
    const branchB: ContextBranch = {
      forkMessageId: "m2",
      id: "b",
      parentBranchId: "main",
    };
    const branchC: ContextBranch = {
      forkMessageId: "b2",
      id: "c",
      parentBranchId: "b",
    };
    const messages = [
      msg("m1", "main", 1),
      msg("m2", "main", 2, "assistant"),
      msg("b1", "b", 1),
      msg("b2", "b", 2, "assistant"),
      msg("c1", "c", 1),
    ];
    expect(
      ids(
        buildBranchContext({
          branches: [MAIN, branchB, branchC],
          branchId: "c",
          messages,
          targetMessageId: "c1",
        }),
      ),
    ).toStrictEqual(["m1", "m2", "b1", "b2", "c1"]);
  });

  it("handles a fork from an empty history (no fork message)", () => {
    const branchB: ContextBranch = {
      forkMessageId: undefined,
      id: "b",
      parentBranchId: "main",
    };
    const messages = [msg("b1", "b", 1)];
    expect(
      ids(
        buildBranchContext({
          branches: [MAIN, branchB],
          branchId: "b",
          messages,
          targetMessageId: "b1",
        }),
      ),
    ).toStrictEqual(["b1"]);
  });

  it("resolves a fork whose fork point is an inherited (ancestor) message", () => {
    // b has no local messages; its visible tip is the inherited m2. c forks
    // from b at m2 (which belongs to main, not b).
    const branchB: ContextBranch = {
      forkMessageId: "m2",
      id: "b",
      parentBranchId: "main",
    };
    const branchC: ContextBranch = {
      forkMessageId: "m2",
      id: "c",
      parentBranchId: "b",
    };
    const messages = [
      msg("m1", "main", 1),
      msg("m2", "main", 2, "assistant"),
      msg("c1", "c", 1),
    ];
    expect(
      ids(
        buildBranchContext({
          branches: [MAIN, branchB, branchC],
          branchId: "c",
          messages,
          targetMessageId: "c1",
        }),
      ),
    ).toStrictEqual(["m1", "m2", "c1"]);
  });
});
