import { describe, expect, it } from "bun:test";
import { forkLabel } from "./fork-label";

describe("forkLabel", () => {
  it("forms the possessive for a named member", () => {
    expect(forkLabel("Alice")).toBe("Alice's fork");
  });

  it("uses 'Your fork' for the current user", () => {
    expect(forkLabel("You")).toBe("Your fork");
  });
});
