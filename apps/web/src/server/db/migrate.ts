import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";

/**
 * Apply every pending SQL migration in `migrationsDir`, in filename order, each
 * inside its own transaction. Applied migrations are recorded in
 * `schema_migrations` so re-running is a no-op. Returns the list of migration
 * names applied by this call (empty when the database is already current).
 *
 * @param log - Progress sink; defaults to a no-op so callers opt into output.
 */
export const runMigrations = async (
  pool: Pool,
  migrationsDir: string,
  log: (message: string) => void = () => undefined,
): Promise<string[]> => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name       TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );

  const appliedResult = await pool.query("SELECT name FROM schema_migrations");
  const applied = new Set(
    appliedResult.rows.map((row) => (row as { name: string }).name),
  );

  const entries = await readdir(migrationsDir);
  const pending = entries
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b))
    .filter((name) => !applied.has(name));

  const results: string[] = [];
  for (const name of pending) {
    const sql = await readFile(join(migrationsDir, name), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        name,
      ]);
      await client.query("COMMIT");
      log(`applied ${name}`);
      results.push(name);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`migration ${name} failed`, { cause: error });
    } finally {
      client.release();
    }
  }
  return results;
};
