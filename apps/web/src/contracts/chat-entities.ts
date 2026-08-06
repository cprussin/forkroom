import { z } from "zod";

/**
 * Client-safe entity shapes exchanged over the snapshot API and realtime
 * events. These cross the server→browser boundary, so they are authored as Zod
 * schemas and parsed on receipt (`docs/guidelines/DATA.md`). Nullable wire
 * fields are normalized to `undefined` in memory (`docs/guidelines/CONTROL_FLOW.md`).
 */

// A field that is absent, `null`, or a string, normalized to `string |
// undefined`. Accepts a *missing* key (`.nullish()`), not just `null`, because
// `JSON.stringify` drops keys whose value is `undefined` — which these fields
// become after the server parses a DB `NULL`. Without this, the value survives
// server-side parsing but its key vanishes over the wire, and the browser's
// re-parse rejects the now-missing key as "Required".
const nullableId = z
  .string()
  .nullish()
  .transform((value) => value ?? undefined);

// Timestamps arrive as ISO strings over JSON (browser) and as `Date` objects
// from the `pg` driver (server). Normalize both to an ISO string.
const timestamp = z
  .union([z.string(), z.date()])
  .transform((value) =>
    typeof value === "string" ? value : value.toISOString(),
  );

export const messageRoleSchema = z.enum(["user", "assistant", "system"]);
export type MessageRole = z.infer<typeof messageRoleSchema>;

export const messageStatusSchema = z.enum([
  "completed",
  "queued",
  "streaming",
  "failed",
]);
export type MessageStatus = z.infer<typeof messageStatusSchema>;

export const generationStatusSchema = z.enum([
  "queued",
  "streaming",
  "completed",
  "failed",
]);
export type GenerationStatus = z.infer<typeof generationStatusSchema>;

export const branchEntitySchema = z.object({
  chatId: z.string(),
  createdAt: timestamp,
  createdByUserId: z.string(),
  forkMessageId: nullableId,
  id: z.string(),
  isMain: z.boolean(),
  ownerUserId: z.string(),
  parentBranchId: nullableId,
});
export type BranchEntity = z.infer<typeof branchEntitySchema>;

export const messageEntitySchema = z.object({
  authorUserId: nullableId,
  branchId: z.string(),
  chatId: z.string(),
  content: z.string(),
  createdAt: timestamp,
  id: z.string(),
  role: messageRoleSchema,
  sequenceNumber: z.number(),
  status: messageStatusSchema,
});
export type MessageEntity = z.infer<typeof messageEntitySchema>;

export const generationEntitySchema = z.object({
  assistantMessageId: z.string(),
  branchId: z.string(),
  chatId: z.string(),
  errorCode: nullableId,
  id: z.string(),
  model: z.string(),
  provider: z.string(),
  status: generationStatusSchema,
  userMessageId: z.string(),
});
export type GenerationEntity = z.infer<typeof generationEntitySchema>;

export const memberEntitySchema = z.object({
  avatarUrl: nullableId,
  displayName: z.string(),
  role: z.enum(["creator", "participant"]),
  userId: z.string(),
});
export type MemberEntity = z.infer<typeof memberEntitySchema>;
