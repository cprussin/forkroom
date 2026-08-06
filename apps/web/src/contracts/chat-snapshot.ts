import { z } from "zod";
import {
  branchEntitySchema,
  generationEntitySchema,
  memberEntitySchema,
  messageEntitySchema,
} from "./chat-entities";

/**
 * The normalized chat snapshot returned by `GET /api/chats/:id`. Clients load
 * this, then subscribe to events from `cursor` onward — fetching the snapshot
 * first and resuming from its cursor avoids a load/subscribe race
 * (`docs/guidelines/DATA.md`, PRD §7.5).
 */
export const chatSnapshotSchema = z.object({
  branches: z.array(branchEntitySchema),
  chat: z.object({
    createdAt: z.union([z.string(), z.date()]),
    creatorUserId: z.string(),
    id: z.string(),
    mainBranchId: z.string(),
    title: z.string(),
  }),
  currentUserId: z.string(),
  currentUserRole: z.enum(["creator", "participant"]),
  cursor: z.number(),
  generations: z.array(generationEntitySchema),
  members: z.array(memberEntitySchema),
  messages: z.array(messageEntitySchema),
});

export type ChatSnapshot = z.infer<typeof chatSnapshotSchema>;
