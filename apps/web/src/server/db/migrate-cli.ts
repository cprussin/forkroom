import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./migrate";
import { getPool } from "./pool";

/** `bun run db:migrate` — apply pending migrations against `DATABASE_URL`. */
const main = async (): Promise<void> => {
  const migrationsDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "migrations",
  );
  const pool = getPool();
  const applied = await runMigrations(pool, migrationsDir, (message) => {
    // biome-ignore lint/suspicious/noConsole: migration CLI progress output
    console.log(message);
  });
  // biome-ignore lint/suspicious/noConsole: migration CLI summary output
  console.log(
    applied.length === 0
      ? "database already up to date"
      : `applied ${applied.length.toString()} migration(s)`,
  );
  await pool.end();
};

await main();
