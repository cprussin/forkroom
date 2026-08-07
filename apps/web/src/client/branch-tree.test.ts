import { describe, expect, it } from "bun:test";
import type { BranchEntity } from "../contracts/chat-entities";
import { buildBranchTree, forkNodes } from "./branch-tree";

const branch = (
  id: string,
  parentBranchId: string | undefined,
  createdAt: string,
): BranchEntity => ({
  chatId: "chat",
  createdAt,
  createdByUserId: id,
  forkMessageId: parentBranchId === undefined ? undefined : "m",
  id,
  isMain: parentBranchId === undefined,
  ownerUserId: id,
  parentBranchId,
});

describe("buildBranchTree", () => {
  it("orders the trunk first, then forks nested under their parent", () => {
    const nodes = buildBranchTree([
      branch("main", undefined, "2026-08-01"),
      branch("forkA", "main", "2026-08-02"),
      branch("forkB", "main", "2026-08-04"),
      branch("nested", "forkA", "2026-08-03"),
    ]);
    expect(nodes.map((node) => node.branchId)).toEqual([
      "main",
      "forkA",
      "nested",
      "forkB",
    ]);
  });

  it("reports the nesting depth of each branch", () => {
    const nodes = buildBranchTree([
      branch("main", undefined, "2026-08-01"),
      branch("forkA", "main", "2026-08-02"),
      branch("nested", "forkA", "2026-08-03"),
    ]);
    const depthOf = (id: string): number | undefined =>
      nodes.find((node) => node.branchId === id)?.depth;
    expect(depthOf("main")).toBe(0);
    expect(depthOf("forkA")).toBe(1);
    expect(depthOf("nested")).toBe(2);
  });

  it("is stable regardless of input ordering", () => {
    const nodes = buildBranchTree([
      branch("forkB", "main", "2026-08-04"),
      branch("nested", "forkA", "2026-08-03"),
      branch("main", undefined, "2026-08-01"),
      branch("forkA", "main", "2026-08-02"),
    ]);
    expect(nodes.map((node) => node.branchId)).toEqual([
      "main",
      "forkA",
      "nested",
      "forkB",
    ]);
  });
});

describe("forkNodes", () => {
  it("keeps every non-trunk branch, nested forks included", () => {
    const forks = forkNodes(
      buildBranchTree([
        branch("main", undefined, "2026-08-01"),
        branch("forkA", "main", "2026-08-02"),
        branch("nested", "forkA", "2026-08-03"),
      ]),
    );
    expect(forks.map((node) => node.branchId)).toEqual(["forkA", "nested"]);
  });

  it("is empty when the chat has only its trunk", () => {
    const forks = forkNodes(
      buildBranchTree([branch("main", undefined, "2026-08-01")]),
    );
    expect(forks).toHaveLength(0);
  });
});
