import { ensureDatabaseReady } from "../../../../server/db/ensure-ready";
import { getServerEnv } from "../../../../server/env";
import { selectModel } from "../../../../server/generation/model/select-model";
import { drainJobs } from "../../../../server/generation/worker";
import { json, problem } from "../../../../server/http/responses";
import { DomainErrors } from "../../../../server/services/domain-error";

// Serverless-friendly worker: a scheduled cron drives this endpoint to drain
// the queue within one invocation. Run alongside — or instead of — the
// standalone `bun run worker` process. Both GET and POST are accepted because
// Vercel Cron issues GET while manual/external pingers may use POST.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_JOBS_PER_TICK = 20;
const TICK_BUDGET_MS = 50_000;

const tick = async (request: Request): Promise<Response> => {
  const env = getServerEnv();
  if (env.CRON_SECRET !== undefined) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${env.CRON_SECRET}`) {
      return problem(DomainErrors.forbidden());
    }
  }
  await ensureDatabaseReady();
  const processed = await drainJobs(
    { model: selectModel(), systemPrompt: env.SYSTEM_PROMPT },
    { leaseTimeoutMs: 60_000, maxAttempts: 5, workerId: env.WORKER_ID },
    AbortSignal.timeout(TICK_BUDGET_MS),
    MAX_JOBS_PER_TICK,
  );
  return json({ processed });
};

export const GET = tick;
export const POST = tick;
