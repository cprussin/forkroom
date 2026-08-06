import { getPool } from "../../../server/db/pool";
import { json } from "../../../server/http/responses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Liveness + database reachability for web and worker health checks. */
export const GET = async (): Promise<Response> => {
  try {
    await getPool().query("SELECT 1");
    return json({ status: "ok" });
  } catch (error) {
    // Report degraded rather than crashing the probe — a real recovery action
    // (surface the failure to the orchestrator) distinct from swallowing it.
    // biome-ignore lint/suspicious/noConsole: health probe failure surfacing
    console.error("health check failed", error);
    return json({ status: "degraded" }, 503);
  }
};
