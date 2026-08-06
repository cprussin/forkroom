import { describe, expect, it } from "bun:test";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit within a window and blocks beyond it", () => {
    const key = "test:allow";
    expect(rateLimit(key, 2, 1000, 0)).toBe(true);
    expect(rateLimit(key, 2, 1000, 100)).toBe(true);
    expect(rateLimit(key, 2, 1000, 200)).toBe(false);
  });

  it("resets after the window elapses", () => {
    const key = "test:reset";
    expect(rateLimit(key, 1, 1000, 0)).toBe(true);
    expect(rateLimit(key, 1, 1000, 500)).toBe(false);
    expect(rateLimit(key, 1, 1000, 1000)).toBe(true);
  });
});
