import { z } from "zod";
import { execute, queryRows } from "../db/client";
import type { Queryable } from "../db/pool";

// Workers park on this Postgres channel; a NOTIFY here wakes them the instant a
// job becomes available. The consumer side lives in
// `generation/listen-for-jobs.ts`, which imports this same constant so producer
// and consumer can never drift.
export const JOB_CHANNEL = "generation_jobs";

/** Enqueue a generation job available immediately. */
export const enqueueGenerationJob = async (
  db: Queryable,
  jobId: string,
  generationId: string,
): Promise<void> => {
  await execute(
    db,
    `INSERT INTO generation_jobs (id, generation_id) VALUES ($1, $2)
     ON CONFLICT (generation_id) DO NOTHING`,
    [jobId, generationId],
  );
  await notifyJobAvailable(db);
};

/** Reset a generation's job to available again for a retry. */
export const requeueGenerationJob = async (
  db: Queryable,
  generationId: string,
): Promise<void> => {
  await execute(
    db,
    `UPDATE generation_jobs
        SET completed_at = NULL,
            locked_at = NULL,
            locked_by = NULL,
            last_error = NULL,
            available_at = now()
      WHERE generation_id = $1`,
    [generationId],
  );
  await notifyJobAvailable(db);
};

const claimedJobSchema = z.object({
  attempts: z.number(),
  generationId: z.string(),
  id: z.string(),
});
export type ClaimedJob = z.infer<typeof claimedJobSchema>;

/**
 * Atomically claim the next available job. `FOR UPDATE SKIP LOCKED` lets many
 * workers poll the same queue without contending: each locks a distinct row and
 * skips rows already locked by a peer. The claim marks the row locked in the
 * same statement so a crashed worker's job is reclaimable after its lock lease.
 */
export const claimNextJob = async (
  db: Queryable,
  workerId: string,
  leaseTimeoutMs: number,
): Promise<ClaimedJob | undefined> => {
  const rows = await queryRows(
    db,
    claimedJobSchema,
    `UPDATE generation_jobs
        SET locked_at = now(),
            locked_by = $1,
            attempts = attempts + 1
      WHERE id = (
        SELECT id FROM generation_jobs
         WHERE completed_at IS NULL
           AND available_at <= now()
           AND (locked_at IS NULL OR locked_at < now() - ($2::text || ' milliseconds')::interval)
         ORDER BY available_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
      )
      RETURNING id AS "id", generation_id AS "generationId", attempts AS "attempts"`,
    [workerId, leaseTimeoutMs.toString()],
  );
  const [row] = rows;
  return row;
};

export const completeJob = async (
  db: Queryable,
  jobId: string,
): Promise<void> => {
  await execute(
    db,
    "UPDATE generation_jobs SET completed_at = now(), locked_at = NULL, locked_by = NULL WHERE id = $1",
    [jobId],
  );
};

/** Release a job's lock and reschedule it after a backoff delay. */
export const rescheduleJob = async (
  db: Queryable,
  jobId: string,
  backoffMs: number,
  error: string,
): Promise<void> => {
  await execute(
    db,
    `UPDATE generation_jobs
        SET locked_at = NULL,
            locked_by = NULL,
            last_error = $3,
            available_at = now() + ($2::text || ' milliseconds')::interval
      WHERE id = $1`,
    [jobId, backoffMs.toString(), error],
  );
};

/**
 * Signal that a job is available now. Issued inside the enqueue/requeue
 * transaction, the NOTIFY is delivered on COMMIT — exactly when the row becomes
 * visible — so a worker parked on the channel picks the job up immediately.
 * Reschedule deliberately does not call this: a backed-off job is available only
 * in the future, and the worker's fallback poll covers that later wakeup.
 */
const notifyJobAvailable = async (db: Queryable): Promise<void> => {
  await execute(db, "SELECT pg_notify($1, '')", [JOB_CHANNEL]);
};
