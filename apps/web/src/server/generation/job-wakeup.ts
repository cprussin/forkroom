/**
 * A source the worker parks on when the generation queue is empty, so it wakes
 * the instant a job is enqueued instead of sleeping a full poll interval.
 */
export type JobWakeup = {
  /**
   * Resolve when a job may be available: on the next job-available
   * notification, immediately if one arrived since the previous `wait` (a latch
   * so a notification delivered while a job was being processed is never lost),
   * after `fallbackMs`, or when `signal` aborts. Single-consumer — only the
   * worker loop calls this, never concurrently.
   */
  wait: (fallbackMs: number, signal: AbortSignal) => Promise<void>;
};

/**
 * Build a {@link JobWakeup} from a subscription primitive. `subscribe` registers
 * a callback invoked once per job-available notification; the transport (a
 * Postgres `LISTEN` connection in production) lives in the caller so this latch
 * stays pure and unit-testable.
 */
export const createJobWakeup = (
  subscribe: (onNotify: () => void) => void,
): JobWakeup => {
  // `pending` latches a notification that arrives with no waiter parked; `wake`
  // is the parked waiter's resolver, if any. Both are genuinely mutable
  // single-consumer state, so `let` is warranted here.
  let pending = false;
  let wake: (() => void) | undefined;

  subscribe(() => {
    pending = true;
    if (wake !== undefined) {
      wake();
    }
  });

  const wait = (fallbackMs: number, signal: AbortSignal): Promise<void> => {
    if (pending || signal.aborted) {
      pending = false;
      return Promise.resolve();
    } else {
      return new Promise<void>((resolve) => {
        const teardown: (() => void)[] = [];
        const settle = () => {
          for (const undo of teardown) {
            undo();
          }
          wake = undefined;
          pending = false;
          resolve();
        };

        const timer = setTimeout(settle, fallbackMs);
        teardown.push(() => {
          clearTimeout(timer);
        });

        const onAbort = () => {
          settle();
        };
        signal.addEventListener("abort", onAbort, { once: true });
        teardown.push(() => {
          signal.removeEventListener("abort", onAbort);
        });

        wake = settle;
      });
    }
  };

  return { wait };
};
