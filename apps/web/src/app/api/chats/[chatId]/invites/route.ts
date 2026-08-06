import { rateLimit } from "../../../../../server/http/rate-limit";
import { problem, respondResult } from "../../../../../server/http/responses";
import { getSessionUserId } from "../../../../../server/http/session-user";
import { DomainErrors } from "../../../../../server/services/domain-error";
import { createInvite } from "../../../../../server/services/invites";

export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> },
): Promise<Response> => {
  const userId = await getSessionUserId();
  if (userId === undefined) {
    return problem(DomainErrors.unauthenticated());
  }
  const { chatId } = await params;
  if (!rateLimit(`invite-create:${userId}`, 20, 60_000)) {
    return problem(DomainErrors.rateLimited());
  }
  const result = await createInvite({ chatId, userId });
  return respondResult(result, 201);
};
