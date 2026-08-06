import { ensureDatabaseReady } from "../db/ensure-ready";
import { getPool } from "../db/pool";
import { getServerEnv } from "../env";
import { selectModel } from "./model/select-model";
import { processNextJob } from "./worker";

/**
 * `bun run worker` — the standalone generation worker. Polls the jobs table and
 * processes one generation at a time. Run one or more of these alongside the web
 * process; `FOR UPDATE SKIP LOCKED` lets them share the queue safely.
 */
const main = async (): Promise<void> => {
  const env = getServerEnv();
  await ensureDatabaseReady();
  const pool = getPool();
  const controller = new AbortController();
  const model = selectModel();
  const config = {
    leaseTimeoutMs: 60_000,
    maxAttempts: 5,
    workerId: env.WORKER_ID,
  };
  const deps = { model, systemPrompt: env.SYSTEM_PROMPT };

  const shutdown = () => {
    controller.abort();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // biome-ignore lint/suspicious/noConsole: worker lifecycle output
  console.log(`worker ${env.WORKER_ID} started (provider=${model.provider})`);

  while (!controller.signal.aborted) {
    const handled = await processNextJob(deps, config, controller.signal);
    if (!handled) {
      await delay(env.WORKER_POLL_INTERVAL_MS);
    }
  }

  await pool.end();
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

await main();
