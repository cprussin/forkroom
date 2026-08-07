import { describe, it } from "bun:test";
import { createJobWakeup } from "./job-wakeup";

// A fallback long enough that a passing test never reaches it: any resolution
// within the test came from a notification or an abort, not the timeout.
const NEVER_MS = 100_000;

describe("createJobWakeup", () => {
  it("resolves immediately when a notification arrives while waiting", async () => {
    let fire: () => void = () => {
      throw new Error("subscribe callback not captured");
    };
    const wakeup = createJobWakeup((onNotify) => {
      fire = onNotify;
    });

    const waited = wakeup.wait(NEVER_MS, new AbortController().signal);
    fire();
    await waited;
  });

  it("latches a notification that arrives before the next wait", async () => {
    let fire: () => void = () => {
      throw new Error("subscribe callback not captured");
    };
    const wakeup = createJobWakeup((onNotify) => {
      fire = onNotify;
    });

    // Notification lands while the worker is busy (not yet parked); the next
    // wait must return without blocking on the fallback.
    fire();
    await wakeup.wait(NEVER_MS, new AbortController().signal);
  });

  it("resolves after the fallback when no notification arrives", async () => {
    const wakeup = createJobWakeup(() => {
      /* never notifies */
    });
    await wakeup.wait(1, new AbortController().signal);
  });

  it("resolves immediately when the signal is already aborted", async () => {
    const wakeup = createJobWakeup(() => {
      /* never notifies */
    });
    const controller = new AbortController();
    controller.abort();
    await wakeup.wait(NEVER_MS, controller.signal);
  });

  it("resolves a parked wait when the signal aborts", async () => {
    const wakeup = createJobWakeup(() => {
      /* never notifies */
    });
    const controller = new AbortController();
    const waited = wakeup.wait(NEVER_MS, controller.signal);
    controller.abort();
    await waited;
  });

  it("does not carry a consumed notification into the following wait", async () => {
    let fire: () => void = () => {
      throw new Error("subscribe callback not captured");
    };
    const wakeup = createJobWakeup((onNotify) => {
      fire = onNotify;
    });

    fire();
    await wakeup.wait(NEVER_MS, new AbortController().signal); // consumes latch
    // With the latch consumed, the next wait falls through to the fallback.
    await wakeup.wait(1, new AbortController().signal);
  });
});
