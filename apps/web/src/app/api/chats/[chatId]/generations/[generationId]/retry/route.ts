import { rateLimit } from "../../../../../../../server/http/rate-limit";
import {
  problem,
  respondResult,
} from "../../../../../../../server/http/responses";
import { getSessionUserId } from "../../../../../../../server/http/session-user";
import { DomainErrors } from "../../../../../../../server/services/domain-error";
import { retryGeneration } from "../../../../../../../server/services/retry-generation";

export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ chatId: string; generationId: string }> },
): Promise<Response> => {
  const userId = await getSessionUserId();
  if (userId === undefined) {
    return problem(DomainErrors.unauthenticated());
  }
  const { chatId, generationId } = await params;
  if (!rateLimit(`retry:${userId}`, 30, 60_000)) {
    return problem(DomainErrors.rateLimited());
  }
  const result = await retryGeneration({ chatId, generationId, userId });
  return respondResult(result);
};
