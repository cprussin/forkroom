import { Pool } from "pg";
import { getServerEnv } from "../env";

/**
 * A minimal query interface satisfied by both `pg.Pool` and `pg.PoolClient`, so
 * repositories can run against a standalone pool or inside a transaction's
 * client without knowing which. Repositories accept a `Queryable` rather than
 * reaching for the global pool, which keeps them injectable in tests.
 */
export type Queryable = {
  query: (
    text: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[]; rowCount: number | null }>;
};

// Reuse a single pool across hot-reloads and serverless invocations. Each cold
// serverless instance keeps its own small pool; a managed Postgres pooler
// (e.g. Neon/PgBouncer) fans these out to the real database.
const globalForPool = globalThis as typeof globalThis & {
  forkroomPool?: Pool;
};

export const getPool = (): Pool => {
  const existing = globalForPool.forkroomPool;
  if (existing === undefined) {
    const pool = new Pool({
      // Bound how long a connect can hang before failing, so a suspended
      // managed database surfaces a fast error that the startup retry rides
      // out rather than blocking indefinitely.
      connectionString: getServerEnv().DATABASE_URL,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      max: 5,
    });
    globalForPool.forkroomPool = pool;
    return pool;
  } else {
    return existing;
  }
};
