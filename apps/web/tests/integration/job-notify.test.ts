import { describe, it } from "bun:test";
import { Pool } from "pg";
import { listenForJobs } from "../../src/server/generation/listen-for-jobs";

// Integration tests need a real Postgres. Provide DATABASE_URL to run them;
// otherwise they are skipped (unit tests always run without a database).
const databaseUrl = Bun.env.DATABASE_URL;
const pool =
  databaseUrl === undefined
    ? undefined
    : new Pool({ connectionString: databaseUrl });

const run = pool === undefined ? describe.skip : describe;

run("job notifications (integration)", () => {
  it("wakes a listener when a job-available NOTIFY is committed", async () => {
    if (pool === undefined) {
      throw new Error("unreachable: suite skipped without a pool");
    }
    const listener = await listenForJobs(pool);
    try {
      // A fallback long enough that resolution can only come from the
      // notification: if LISTEN/NOTIFY did not round-trip, the test would hang
      // and fail on timeout rather than pass on the fallback.
      const waited = listener.wakeup.wait(
        100_000,
        new AbortController().signal,
      );
      await pool.query("SELECT pg_notify('generation_jobs', '')");
      await waited;
    } finally {
      await listener.close();
    }
  });
});
