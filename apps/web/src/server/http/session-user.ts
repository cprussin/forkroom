import { z } from "zod";
import { auth } from "../auth/config";

const sessionUserSchema = z.object({
  user: z.object({ id: z.string() }),
});

/**
 * The authenticated user's id, or `undefined` when unauthenticated. Reads the
 * Auth.js session and parses it at the boundary rather than trusting its shape.
 */
export const getSessionUserId = async (): Promise<string | undefined> => {
  const session = await auth();
  const parsed = sessionUserSchema.safeParse(session);
  return parsed.success ? parsed.data.user.id : undefined;
};
