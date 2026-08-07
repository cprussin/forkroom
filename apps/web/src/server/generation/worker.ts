import type { Queryable } from "../db/pool";
import { getPool } from "../db/pool";
import { claimNextJob, completeJob, rescheduleJob } from "../repositories/jobs";
import type { JobWakeup } from "./job-wakeup";
import type { RunGenerationDeps } from "./run-generation";
import { runGeneration } from "./run-generation";

export type WorkerConfig = {
  workerId: string;
  leaseTimeoutMs: number;
  maxAttempts: number;
};

/** One turn of the queue: process the next job, reporting whether one existed. */
export type JobStep = (signal: AbortSignal) => Promise<boolean>;

/**
 * Drive the generation queue until `signal` aborts. Consecutive jobs are
 * drained back-to-back; only when a turn finds the queue empty does the loop
 * park on `wakeup`, which resolves the instant a job is enqueued (or after
 * `fallbackMs`). Parking on the wakeup rather than sleeping a fixed interval is
 * what makes a freshly submitted prompt start generating with near-zero pickup
 * latency.
 */
export const runWorkerLoop = async (
  step: JobStep,
  wakeup: JobWakeup,
  fallbackMs: number,
  signal: AbortSignal,
): Promise<void> => {
  while (!signal.aborted) {
    const handled = await step(signal);
    if (!handled) {
      await wakeup.wait(fallbackMs, signal);
    }
  }
};

/**
 * Claim and process one generation job. Returns `true` when a job was handled
 * and `false` when the queue was empty. `runGeneration` persists terminal model
 * outcomes itself, so a normal return completes the job; a thrown
 * infrastructure error reschedules with backoff until `maxAttempts`, after which
 * the job is abandoned (the generation keeps whatever state it reached).
 */
export const processNextJob = async (
  deps: RunGenerationDeps,
  config: WorkerConfig,
  signal: AbortSignal,
  pool: Queryable = getPool(),
): Promise<boolean> => {
  const job = await claimNextJob(pool, config.workerId, config.leaseTimeoutMs);
  if (job === undefined) {
    return false;
  } else {
    try {
      await runGeneration(job.generationId, deps, signal);
      await completeJob(pool, job.id);
    } catch (error) {
      if (job.attempts >= config.maxAttempts) {
        await completeJob(pool, job.id);
      } else {
        await rescheduleJob(
          pool,
          job.id,
          backoffMs(job.attempts),
          summarizeError(error),
        );
      }
    }
    return true;
  }
};

/** Drain the queue until empty, returning how many jobs were processed. */
export const drainJobs = async (
  deps: RunGenerationDeps,
  config: WorkerConfig,
  signal: AbortSignal,
  maxJobs: number,
  pool: Queryable = getPool(),
): Promise<number> => {
  let processed = 0;
  while (processed < maxJobs && !signal.aborted) {
    const handled = await processNextJob(deps, config, signal, pool);
    if (!handled) {
      break;
    }
    processed += 1;
  }
  return processed;
};

const backoffMs = (attempts: number): number =>
  Math.min(30_000, 1000 * 2 ** attempts);

const summarizeError = (error: unknown): string =>
  error instanceof Error ? error.name : "unknown_error";
