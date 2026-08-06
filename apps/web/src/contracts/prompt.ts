import { z } from "zod";

/**
 * Prompt submission request body. The client supplies the branch its composer
 * is scoped to and the tip message it believes is current; the server decides
 * append vs fork and rejects a stale tip. `idempotencyKey` makes retries safe.
 */
export const submitPromptRequestSchema = z.object({
  content: z.string().min(1),
  expectedTipMessageId: z.string().nullable(),
  idempotencyKey: z.string().min(1).max(200),
  selectedBranchId: z.string(),
});
export type SubmitPromptRequest = z.infer<typeof submitPromptRequestSchema>;

export const submitPromptResponseSchema = z.object({
  branchId: z.string(),
  forkMessageId: z.string().nullable(),
  generationId: z.string(),
  mode: z.enum(["appended", "forked"]),
  parentBranchId: z.string().nullable(),
  userMessageId: z.string(),
});
export type SubmitPromptResponse = z.infer<typeof submitPromptResponseSchema>;
