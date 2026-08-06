import { z } from "zod";

/**
 * Server-only environment configuration, parsed once at first access.
 *
 * This is the single place the process environment is read (per
 * `docs/guidelines/DATA.md`: parse external data at the boundary, never trust
 * it raw). Domain modules never import this — keeping them pure and testable
 * without a populated environment — so the parse is lazy: importing this module
 * does not throw, only calling `getServerEnv()` does when required vars are
 * missing.
 */
const serverEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AUTH_GITHUB_ID: z.string().min(1).optional(),
  AUTH_GITHUB_SECRET: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1),
  CRON_SECRET: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1),
  MAX_PROMPT_CHARS: z.coerce.number().int().positive().default(16_000),
  MODEL_NAME: z.string().min(1).default("claude-3-5-haiku-latest"),
  MODEL_PROVIDER: z.enum(["anthropic", "mock"]).default("mock"),
  SYSTEM_PROMPT: z
    .string()
    .default(
      "You are a helpful, concise assistant in a collaborative chat. Answer in Markdown.",
    ),
  WORKER_ID: z.string().min(1).default("worker-1"),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export const getServerEnv = (): ServerEnv => {
  if (cached === undefined) {
    cached = serverEnvSchema.parse(readRawEnv());
  }
  return cached;
};

// The sole raw `process.env` read in the codebase. Everything else consumes the
// parsed, typed `ServerEnv`.
// biome-ignore lint/style/noProcessEnv: centralized environment boundary
const readRawEnv = (): Record<string, string | undefined> => process.env;
