import type { PoolClient } from "pg";
import type { z } from "zod";
import type { Queryable } from "./pool";
import { getPool } from "./pool";

/**
 * Run a parameterized query and parse every row through a Zod schema. SQL rows
 * are external data (`docs/guidelines/DATA.md`): they are parsed at this
 * boundary and trusted by their static type thereafter. Never interpolate user
 * values into `text` — pass them as `params`.
 */
export const queryRows = async <T>(
  db: Queryable,
  rowSchema: z.ZodType<T, z.ZodTypeDef, unknown>,
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> => {
  const result = await db.query(text, params);
  return result.rows.map((row) => rowSchema.parse(row));
};

/**
 * Run a query expected to return exactly one row (e.g. an `INSERT ...
 * RETURNING`). Throws when the row count is not one — a broken invariant, not a
 * recoverable condition.
 */
export const queryOne = async <T>(
  db: Queryable,
  rowSchema: z.ZodType<T, z.ZodTypeDef, unknown>,
  text: string,
  params: readonly unknown[] = [],
): Promise<T> => {
  const rows = await queryRows(db, rowSchema, text, params);
  const [first] = rows;
  if (first === undefined || rows.length !== 1) {
    throw new Error(
      `expected exactly one row, got ${rows.length.toString()} for query: ${text}`,
    );
  } else {
    return first;
  }
};

/** Run a query for its side effects, returning the affected row count. */
export const execute = async (
  db: Queryable,
  text: string,
  params: readonly unknown[] = [],
): Promise<number> => {
  const result = await db.query(text, params);
  return result.rowCount ?? 0;
};

/**
 * Run `work` inside a single transaction, committing on success and rolling
 * back on any thrown error before re-throwing. The callback receives the
 * transaction's client as a `Queryable` so every statement it issues shares the
 * transaction and its locks.
 */
export const withTransaction = async <T>(
  work: (tx: Queryable) => Promise<T>,
  db = getPool(),
): Promise<T> => {
  const client: PoolClient = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
