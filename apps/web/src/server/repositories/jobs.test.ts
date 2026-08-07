import { describe, expect, it } from "bun:test";
import type { Queryable } from "../db/pool";
import {
  enqueueGenerationJob,
  requeueGenerationJob,
  rescheduleJob,
} from "./jobs";

type RecordedQuery = { text: string; params: readonly unknown[] };

// A Queryable that records the statements issued against it, so a repository's
// side effects can be asserted without a database.
const recordingDb = (): Queryable & { queries: RecordedQuery[] } => {
  const queries: RecordedQuery[] = [];
  return {
    queries,
    query: (text: string, params: readonly unknown[] = []) => {
      queries.push({ params, text });
      return Promise.resolve({ rowCount: 1, rows: [] });
    },
  };
};

const notifications = (db: { queries: RecordedQuery[] }): RecordedQuery[] =>
  db.queries.filter((q) => q.text.includes("pg_notify"));

describe("enqueueGenerationJob", () => {
  it("notifies the generation_jobs channel so a listening worker wakes at once", async () => {
    const db = recordingDb();
    await enqueueGenerationJob(db, "job-1", "gen-1");

    const [notify, ...rest] = notifications(db);
    expect(rest).toHaveLength(0);
    expect(notify?.params).toContain("generation_jobs");
  });
});

describe("requeueGenerationJob", () => {
  it("notifies the generation_jobs channel when a retry becomes available", async () => {
    const db = recordingDb();
    await requeueGenerationJob(db, "gen-1");

    const [notify, ...rest] = notifications(db);
    expect(rest).toHaveLength(0);
    expect(notify?.params).toContain("generation_jobs");
  });
});

describe("rescheduleJob", () => {
  it("does not notify, since a backed-off job is not yet available", async () => {
    const db = recordingDb();
    await rescheduleJob(db, "job-1", 5000, "TimeoutError");

    expect(notifications(db)).toHaveLength(0);
  });
});
