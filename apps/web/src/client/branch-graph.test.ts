import { describe, expect, it } from "bun:test";
import type { BranchEntity } from "../contracts/chat-entities";
import { branchGraphHasForks, layoutBranchGraph } from "./branch-graph";

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

const sample = (): BranchEntity[] => [
  branch("forkB", "main", "2026-08-04"),
  branch("nested", "forkA", "2026-08-03"),
  branch("main", undefined, "2026-08-01"),
  branch("forkA", "main", "2026-08-02"),
];

describe("layoutBranchGraph", () => {
  it("places the trunk in lane 0 and each fork one lane further out", () => {
    const { nodes } = layoutBranchGraph(sample());
    const laneOf = (id: string): number | undefined =>
      nodes.find((node) => node.branchId === id)?.lane;
    expect(laneOf("main")).toBe(0);
    expect(laneOf("forkA")).toBe(1);
    expect(laneOf("nested")).toBe(2);
    expect(laneOf("forkB")).toBe(1);
  });

  it("rows follow depth-first order regardless of input order", () => {
    const { nodes } = layoutBranchGraph(sample());
    const byRow = [...nodes].sort((a, b) => a.row - b.row);
    expect(byRow.map((node) => node.branchId)).toEqual([
      "main",
      "forkA",
      "nested",
      "forkB",
    ]);
  });

  it("connects each fork to the branch it sprang from", () => {
    const { edges } = layoutBranchGraph(sample());
    expect(edges).toContainEqual({ fromBranchId: "main", toBranchId: "forkA" });
    expect(edges).toContainEqual({ fromBranchId: "main", toBranchId: "forkB" });
    expect(edges).toContainEqual({
      fromBranchId: "forkA",
      toBranchId: "nested",
    });
    expect(edges).toHaveLength(3);
  });

  it("reports the number of lanes spanned", () => {
    expect(layoutBranchGraph(sample()).laneCount).toBe(3);
  });
});

describe("branchGraphHasForks", () => {
  it("is true when the chat has at least one fork", () => {
    expect(branchGraphHasForks(layoutBranchGraph(sample()))).toBe(true);
  });

  it("is false for a chat that is only its trunk", () => {
    const graph = layoutBranchGraph([branch("main", undefined, "2026-08-01")]);
    expect(branchGraphHasForks(graph)).toBe(false);
  });
});
