import { z } from "zod";
import { rateLimit } from "../../../server/http/rate-limit";
import { json, problem, readJson } from "../../../server/http/responses";
import { getSessionUserId } from "../../../server/http/session-user";
import { createChat } from "../../../server/services/create-chat";
import { DomainErrors } from "../../../server/services/domain-error";

const bodySchema = z.object({ title: z.string().min(1).max(120) });

export const POST = async (request: Request): Promise<Response> => {
  const userId = await getSessionUserId();
  if (userId === undefined) {
    return problem(DomainErrors.unauthenticated());
  }
  if (!rateLimit(`create-chat:${userId}`, 30, 60_000)) {
    return problem(DomainErrors.rateLimited());
  }
  const body = await readJson(request, bodySchema);
  if (!body.ok) {
    return body.response;
  }
  const result = await createChat({ title: body.value.title, userId });
  return json(result, 201);
};
