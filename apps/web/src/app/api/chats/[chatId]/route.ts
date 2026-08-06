import { getPool } from "../../../../server/db/pool";
import { canReadChat } from "../../../../server/domain/authorization";
import { json, problem } from "../../../../server/http/responses";
import { getSessionUserId } from "../../../../server/http/session-user";
import { getMemberRole } from "../../../../server/repositories/members";
import { getChatSnapshot } from "../../../../server/repositories/snapshot";
import { DomainErrors } from "../../../../server/services/domain-error";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> },
): Promise<Response> => {
  const userId = await getSessionUserId();
  if (userId === undefined) {
    return problem(DomainErrors.unauthenticated());
  }
  const { chatId } = await params;
  const role = await getMemberRole(getPool(), chatId, userId);
  if (role === undefined || !canReadChat(role)) {
    return problem(DomainErrors.notMember());
  }
  const snapshot = await getChatSnapshot(getPool(), chatId, userId, role);
  return snapshot === undefined
    ? problem(DomainErrors.chatNotFound())
    : json(snapshot);
};
