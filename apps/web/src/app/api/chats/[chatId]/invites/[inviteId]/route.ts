import {
  problem,
  respondResult,
} from "../../../../../../server/http/responses";
import { getSessionUserId } from "../../../../../../server/http/session-user";
import { DomainErrors } from "../../../../../../server/services/domain-error";
import { revokeInvite } from "../../../../../../server/services/invites";

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ chatId: string; inviteId: string }> },
): Promise<Response> => {
  const userId = await getSessionUserId();
  if (userId === undefined) {
    return problem(DomainErrors.unauthenticated());
  }
  const { chatId, inviteId } = await params;
  const result = await revokeInvite({ chatId, inviteId, userId });
  return respondResult(result);
};
