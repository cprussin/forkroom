import { z } from "zod";

/**
 * A row in the sidebar's chat history: enough to link to a chat and order the
 * list by recent activity. Server-derived and passed to the client shell, so
 * the timestamp is normalized to an ISO string (`pg` yields a `Date`).
 */
export const chatListItemSchema = z.object({
  id: z.string(),
  lastActivityAt: z
    .union([z.string(), z.date()])
    .transform((value) =>
      typeof value === "string" ? value : value.toISOString(),
    ),
  title: z.string(),
});
export type ChatListItem = z.infer<typeof chatListItemSchema>;
