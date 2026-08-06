import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./migrate";
import { getPool } from "./pool";

/**
 * `bun run db:reset` — DEVELOPMENT ONLY. Drops the public schema and re-applies
 * all migrations, discarding every chat, message, and user. Refuses to run when
 * `NODE_ENV=production` so it can never wipe a deployed database.
 */
const main = async (): Promise<void> => {
  // biome-ignore lint/style/noProcessEnv: single guard read, mirrors env boundary
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "production") {
    throw new Error("db:reset is disabled when NODE_ENV=production");
  }

  const pool = getPool();
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  const migrationsDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "migrations",
  );
  await runMigrations(pool, migrationsDir, (message) => {
    // biome-ignore lint/suspicious/noConsole: reset CLI progress output
    console.log(message);
  });
  // biome-ignore lint/suspicious/noConsole: reset CLI summary output
  console.log("database reset complete");
  await pool.end();
};

await main();
