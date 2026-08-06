/**
 * Next.js instrumentation hook. Runs once when the server process starts. We
 * use it to apply database migrations automatically, so a fresh deployment (or
 * local `start:dev`) initializes its schema on first boot with no manual
 * migrate step. Guarded to the Node runtime so the edge runtime never loads the
 * Postgres driver.
 */
export const register = async (): Promise<void> => {
  // biome-ignore lint/style/noProcessEnv: runtime discriminator set by Next itself
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureDatabaseReady } = await import("./server/db/ensure-ready");
    await ensureDatabaseReady();
  }
};
