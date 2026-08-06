const DEFAULT_MAX_ATTEMPTS = 6;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8000;

const backoffFor = (priorAttempts: number): number =>
  Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** priorAttempts);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Run `operation`, retrying on failure with exponential backoff and rethrowing
 * the last error (as `cause`) once attempts are exhausted. Retrying is a real
 * recovery action, not swallowing (see docs/guidelines/ERRORS.md): a genuine
 * failure still surfaces loudly after the retries.
 *
 * The motivating case is a managed database — e.g. Neon's free tier — resetting
 * the first connection while its compute wakes from suspend, which otherwise
 * crashes startup on the very first request after an idle period.
 *
 * @param delayFn - Backoff sleeper; defaults to a real timer and is injectable
 *   so tests exercise the retry logic without waiting.
 */
export const withRetry = async (
  operation: () => Promise<void>,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  delayFn: (ms: number) => Promise<void> = sleep,
): Promise<void> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await delayFn(backoffFor(attempt - 1));
    }
    try {
      await operation();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`operation failed after ${maxAttempts.toString()} attempts`, {
    cause: lastError,
  });
};
