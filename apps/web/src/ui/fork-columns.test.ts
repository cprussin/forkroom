import { describe, expect, it } from "bun:test";
import { planForkColumns } from "./fork-columns";

describe("planForkColumns", () => {
  it("keeps every column and centres the followed branch when all have content", () => {
    expect(
      planForkColumns("main", [
        { branchId: "main", hasContent: true },
        { branchId: "forkA", hasContent: true },
      ]),
    ).toEqual({ branchIds: ["main", "forkA"], centredBranchId: "main" });
  });

  it("drops an empty trunk column and centres a real continuation (tip fork)", () => {
    // Forked from the tip: the followed branch (main) has nothing past the fork.
    expect(
      planForkColumns("main", [
        { branchId: "main", hasContent: false },
        { branchId: "forkA", hasContent: true },
        { branchId: "forkB", hasContent: true },
      ]),
    ).toEqual({ branchIds: ["forkA", "forkB"], centredBranchId: "forkA" });
  });

  it("centres the followed branch even when other columns are dropped", () => {
    expect(
      planForkColumns("forkB", [
        { branchId: "main", hasContent: false },
        { branchId: "forkA", hasContent: true },
        { branchId: "forkB", hasContent: true },
      ]),
    ).toEqual({ branchIds: ["forkA", "forkB"], centredBranchId: "forkB" });
  });

  it("returns undefined when no variant has a continuation to show", () => {
    expect(
      planForkColumns("main", [
        { branchId: "main", hasContent: false },
        { branchId: "forkA", hasContent: false },
      ]),
    ).toBeUndefined();
  });
});
