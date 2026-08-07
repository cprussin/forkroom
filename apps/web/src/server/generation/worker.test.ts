import { describe, expect, it } from "bun:test";
import type { JobWakeup } from "./job-wakeup";
import { runWorkerLoop } from "./worker";

// A wakeup that records how often it is parked on and never blocks, so a loop
// test resolves without real timers.
const countingWakeup = (): JobWakeup & { waits: () => number } => {
  let waits = 0;
  return {
    wait: () => {
      waits += 1;
      return Promise.resolve();
    },
    waits: () => waits,
  };
};

describe("runWorkerLoop", () => {
  it("parks on the wakeup after each empty turn and stops when aborted", async () => {
    const controller = new AbortController();
    const wakeup = countingWakeup();
    let turns = 0;
    const step = (): Promise<boolean> => {
      turns += 1;
      if (turns >= 3) {
        controller.abort();
      }
      return Promise.resolve(false);
    };

    await runWorkerLoop(step, wakeup, 1000, controller.signal);

    expect(turns).toBe(3);
    expect(wakeup.waits()).toBe(3);
  });

  it("drains consecutive jobs without parking", async () => {
    const controller = new AbortController();
    const wakeup = countingWakeup();
    let processed = 0;
    const step = (): Promise<boolean> => {
      processed += 1;
      if (processed >= 2) {
        controller.abort();
      }
      return Promise.resolve(true);
    };

    await runWorkerLoop(step, wakeup, 1000, controller.signal);

    expect(processed).toBe(2);
    expect(wakeup.waits()).toBe(0);
  });

  it("does nothing when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const wakeup = countingWakeup();
    let turns = 0;
    const step = (): Promise<boolean> => {
      turns += 1;
      return Promise.resolve(false);
    };

    await runWorkerLoop(step, wakeup, 1000, controller.signal);

    expect(turns).toBe(0);
    expect(wakeup.waits()).toBe(0);
  });
});
