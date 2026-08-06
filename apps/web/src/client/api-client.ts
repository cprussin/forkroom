import { z } from "zod";
import type { ChatSnapshot } from "../contracts/chat-snapshot";
import { chatSnapshotSchema } from "../contracts/chat-snapshot";
import type { SubmitPromptResponse } from "../contracts/prompt";
import { submitPromptResponseSchema } from "../contracts/prompt";

export type ApiError = { code: string; title: string; status: number };
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

const problemSchema = z.object({
  code: z.string(),
  status: z.number(),
  title: z.string(),
});

const createChatResponseSchema = z.object({
  chatId: z.string(),
  mainBranchId: z.string(),
});

const createInviteResponseSchema = z.object({
  expiresAt: z.string(),
  inviteId: z.string(),
  token: z.string(),
});

const acceptInviteResponseSchema = z.object({ chatId: z.string() });

export const createChat = (
  title: string,
): Promise<ApiResult<{ chatId: string }>> =>
  request("/api/chats", "POST", { title }, createChatResponseSchema);

export const submitPrompt = (
  chatId: string,
  body: {
    content: string;
    selectedBranchId: string;
    expectedTipMessageId: string | null;
    idempotencyKey: string;
  },
): Promise<ApiResult<SubmitPromptResponse>> =>
  request(
    `/api/chats/${chatId}/prompts`,
    "POST",
    body,
    submitPromptResponseSchema,
  );

export const retryGeneration = (
  chatId: string,
  generationId: string,
): Promise<ApiResult<{ generationId: string }>> =>
  request(
    `/api/chats/${chatId}/generations/${generationId}/retry`,
    "POST",
    {},
    z.object({ generationId: z.string() }),
  );

export const createInvite = (
  chatId: string,
): Promise<ApiResult<z.infer<typeof createInviteResponseSchema>>> =>
  request(
    `/api/chats/${chatId}/invites`,
    "POST",
    {},
    createInviteResponseSchema,
  );

export const acceptInvite = (
  token: string,
): Promise<ApiResult<{ chatId: string }>> =>
  request(
    `/api/invites/${token}/accept`,
    "POST",
    {},
    acceptInviteResponseSchema,
  );

export const fetchSnapshot = async (chatId: string): Promise<ChatSnapshot> => {
  const result = await request(
    `/api/chats/${chatId}`,
    "GET",
    undefined,
    chatSnapshotSchema,
  );
  if (result.ok) {
    return result.data;
  } else {
    throw new Error(`snapshot fetch failed: ${result.error.code}`);
  }
};

const request = async <T>(
  url: string,
  method: "GET" | "POST",
  body: unknown,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<ApiResult<T>> => {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  const response = await fetch(url, init);
  const payload: unknown = await response.json().catch(() => undefined);
  if (response.ok) {
    return { data: schema.parse(payload), ok: true };
  } else {
    const problem = problemSchema.safeParse(payload);
    return {
      error: problem.success
        ? problem.data
        : { code: "unknown", status: response.status, title: "Request failed" },
      ok: false,
    };
  }
};
