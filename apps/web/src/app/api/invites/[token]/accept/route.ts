import { rateLimit } from "../../../../../server/http/rate-limit";
import { problem, respondResult } from "../../../../../server/http/responses";
import { getSessionUserId } from "../../../../../server/http/session-user";
import { DomainErrors } from "../../../../../server/services/domain-error";
import { acceptInvite } from "../../../../../server/services/invites";

export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> => {
  const userId = await getSessionUserId();
  if (userId === undefined) {
    return problem(DomainErrors.unauthenticated());
  }
  const { token } = await params;
  if (!rateLimit(`invite-accept:${userId}`, 30, 60_000)) {
    return problem(DomainErrors.rateLimited());
  }
  const result = await acceptInvite({ token, userId });
  return respondResult(result);
};
