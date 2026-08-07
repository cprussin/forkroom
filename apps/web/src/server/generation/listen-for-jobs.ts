import type { Pool, PoolClient } from "pg";
import { JOB_CHANNEL } from "../repositories/jobs";
import type { JobWakeup } from "./job-wakeup";
import { createJobWakeup } from "./job-wakeup";

export type JobListener = {
  wakeup: JobWakeup;
  close: () => Promise<void>;
};

/**
 * Subscribe to job-available notifications on a dedicated Postgres connection,
 * returning a {@link JobWakeup} that resolves the instant `enqueueGenerationJob`
 * fires on the `generation_jobs` channel.
 *
 * The connection must be a session connection: `LISTEN` does not survive a
 * transaction-pooling proxy (a Neon pooled endpoint / PgBouncer in transaction
 * mode), so the worker's `DATABASE_URL` must point at a direct endpoint. If
 * notifications never arrive the worker still drains at its fallback poll
 * interval — degraded latency, never stuck.
 *
 * `LISTEN`/`UNLISTEN` cannot bind their channel as a parameter, so the
 * hardcoded {@link JOB_CHANNEL} constant is interpolated directly; it is never
 * external input.
 */
export const listenForJobs = async (pool: Pool): Promise<JobListener> => {
  const client: PoolClient = await pool.connect();
  await client.query(`LISTEN ${JOB_CHANNEL}`);

  // The connection listens to exactly one channel, so every notification it
  // receives is a job-available signal — no channel filtering needed.
  const wakeup = createJobWakeup((onNotify) => {
    client.on("notification", onNotify);
  });

  const close = async (): Promise<void> => {
    client.removeAllListeners("notification");
    await client.query(`UNLISTEN ${JOB_CHANNEL}`);
    client.release();
  };

  return { close, wakeup };
};
