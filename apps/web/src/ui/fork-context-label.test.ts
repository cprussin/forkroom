import { describe, expect, it } from "bun:test";
import { viewingForkLabel } from "./fork-context-label";

describe("viewingForkLabel", () => {
  it("frames the owner's fork as the thread being viewed", () => {
    expect(viewingForkLabel("Alice")).toBe("Viewing Alice's fork");
  });
});
