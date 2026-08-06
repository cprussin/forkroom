import type { Queryable } from "../db/pool";
import { getPool } from "../db/pool";
import { claimNextJob, completeJob, rescheduleJob } from "../repositories/jobs";
import type { RunGenerationDeps } from "./run-generation";
import { runGeneration } from "./run-generation";

export type WorkerConfig = {
  workerId: string;
  leaseTimeoutMs: number;
  maxAttempts: number;
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
