import { submitPromptRequestSchema } from "../../../../../contracts/prompt";
import { getServerEnv } from "../../../../../server/env";
import { rateLimit } from "../../../../../server/http/rate-limit";
import {
  problem,
  readJson,
  respondResult,
} from "../../../../../server/http/responses";
import { getSessionUserId } from "../../../../../server/http/session-user";
import { DomainErrors } from "../../../../../server/services/domain-error";
import { submitPrompt } from "../../../../../server/services/submit-prompt";

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ chatId: string }> },
): Promise<Response> => {
  const userId = await getSessionUserId();
  if (userId === undefined) {
    return problem(DomainErrors.unauthenticated());
  }
  const { chatId } = await params;
  if (!rateLimit(`prompt:${userId}`, 60, 60_000)) {
    return problem(DomainErrors.rateLimited());
  }
  const body = await readJson(request, submitPromptRequestSchema);
  if (!body.ok) {
    return body.response;
  }
  const env = getServerEnv();
  const result = await submitPrompt(
    { body: body.value, chatId, userId },
    {
      maxPromptChars: env.MAX_PROMPT_CHARS,
      model: env.MODEL_NAME,
      provider: env.MODEL_PROVIDER,
    },
  );
  return respondResult(result, 201);
};
