import { describe, expect, it } from "bun:test";
import { withRetry } from "./with-retry";

const noDelay = (): Promise<void> => Promise.resolve();

describe("withRetry", () => {
  it("returns after the first success without delaying", async () => {
    let calls = 0;
    let delays = 0;
    await withRetry(
      () => {
        calls += 1;
        return Promise.resolve();
      },
      6,
      () => {
        delays += 1;
        return Promise.resolve();
      },
    );
    expect(calls).toBe(1);
    expect(delays).toBe(0);
  });

  it("retries transient failures until one succeeds", async () => {
    let calls = 0;
    await withRetry(
      () => {
        calls += 1;
        return calls < 3
          ? Promise.reject(new Error("ECONNRESET"))
          : Promise.resolve();
      },
      6,
      noDelay,
    );
    expect(calls).toBe(3);
  });

  it("throws after exhausting attempts, preserving the last error as cause", async () => {
    let calls = 0;
    const failing = withRetry(
      () => {
        calls += 1;
        return Promise.reject(new Error(`fail ${calls.toString()}`));
      },
      3,
      noDelay,
    );
    await expect(failing).rejects.toThrow("failed after 3 attempts");
    expect(calls).toBe(3);
  });
});
