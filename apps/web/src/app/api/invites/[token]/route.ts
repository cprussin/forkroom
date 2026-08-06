import { rateLimit } from "../../../../server/http/rate-limit";
import { problem, respondResult } from "../../../../server/http/responses";
import { DomainErrors } from "../../../../server/services/domain-error";
import { previewInvite } from "../../../../server/services/invites";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> => {
  const { token } = await params;
  if (!rateLimit(`invite-preview:${token}`, 30, 60_000)) {
    return problem(DomainErrors.rateLimited());
  }
  const result = await previewInvite({ token });
  return respondResult(result);
};
