import { defineConfig, devices } from "@playwright/test";

// biome-ignore lint/style/noProcessEnv: Playwright config runs in Node, outside the app's env boundary
const env = process.env;

/**
 * End-to-end config. Assumes a running app at `E2E_BASE_URL` (default
 * http://localhost:3000) with a migrated, seeded database and a worker (or the
 * `/api/worker/tick` cron) draining generations. See `tests/e2e/README.md`.
 */
export default defineConfig({
  forbidOnly: Boolean(env.CI),
  fullyParallel: false,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: "list",
  retries: 0,
  testDir: "./tests/e2e",
  use: {
    baseURL: env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
});
