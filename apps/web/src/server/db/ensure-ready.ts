import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./migrate";
import { getPool } from "./pool";
import { withRetry } from "./with-retry";

let readiness: Promise<void> | undefined;

/**
 * Ensure the database schema is current, applying any pending migrations. Runs
 * at most once per process on success (memoized) and is idempotent, so it is
 * safe to call on every server cold start and worker boot — the app
 * self-initializes its database with no manual migrate step.
 *
 * Migration is retried with backoff so a managed database resetting the first
 * connection while it wakes from suspend (common on Neon's free tier) doesn't
 * crash startup. A failed attempt is NOT memoized: the promise is cleared on
 * rejection so a later request retries instead of reusing a permanently-rejected
 * result.
 */
export const ensureDatabaseReady = (): Promise<void> => {
  if (readiness === undefined) {
    const attempt = withRetry(() =>
      runMigrations(getPool(), resolveMigrationsDir()).then(() => undefined),
    );
    readiness = attempt;
    attempt.catch(() => {
      if (readiness === attempt) {
        readiness = undefined;
      }
    });
  }
  return readiness;
};

// The migrations directory ships beside the app. Resolve it from the current
// working directory first (local dev, and serverless bundles that trace it in),
// falling back to a path relative to this module.
const resolveMigrationsDir = (): string => {
  const candidates = [
    join(process.cwd(), "migrations"),
    join(process.cwd(), "apps", "web", "migrations"),
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "..",
      "migrations",
    ),
  ];
  const found = candidates.find((dir) => existsSync(dir));
  if (found === undefined) {
    throw new Error(
      `could not locate migrations directory (looked in: ${candidates.join(", ")})`,
    );
  } else {
    return found;
  }
};
