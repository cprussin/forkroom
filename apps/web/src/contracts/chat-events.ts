import { z } from "zod";
import {
  branchEntitySchema,
  generationEntitySchema,
  memberEntitySchema,
  messageEntitySchema,
} from "./chat-entities";

/**
 * Realtime events broadcast to a chat's members. This is a wire contract:
 * discriminated by the string `type`, authored as the Zod schema that parses
 * it, with a constructor object so producers build events in one place
 * (`docs/guidelines/DISCRIMINATED_UNIONS.md`). Every event carries a
 * monotonically increasing `id` (the outbox sequence) so clients dedupe and
 * detect gaps.
 */

const envelope = { chatId: z.string(), id: z.number() };

const branchCreatedSchema = z.object({
  ...envelope,
  branch: branchEntitySchema,
  type: z.literal("branch_created"),
});

const messageCreatedSchema = z.object({
  ...envelope,
  message: messageEntitySchema,
  type: z.literal("message_created"),
});

const messageUpdatedSchema = z.object({
  ...envelope,
  message: messageEntitySchema,
  type: z.literal("message_updated"),
});

const assistantDeltaSchema = z.object({
  ...envelope,
  branchId: z.string(),
  messageId: z.string(),
  textDelta: z.string(),
  type: z.literal("assistant_delta"),
});

const generationUpdatedSchema = z.object({
  ...envelope,
  generation: generationEntitySchema,
  type: z.literal("generation_updated"),
});

const memberJoinedSchema = z.object({
  ...envelope,
  member: memberEntitySchema,
  type: z.literal("member_joined"),
});

export const chatEventSchema = z.discriminatedUnion("type", [
  branchCreatedSchema,
  messageCreatedSchema,
  messageUpdatedSchema,
  assistantDeltaSchema,
  generationUpdatedSchema,
  memberJoinedSchema,
]);

export type ChatEvent = z.infer<typeof chatEventSchema>;
export type BranchCreatedEvent = z.infer<typeof branchCreatedSchema>;
export type MessageCreatedEvent = z.infer<typeof messageCreatedSchema>;
export type MessageUpdatedEvent = z.infer<typeof messageUpdatedSchema>;
export type AssistantDeltaEvent = z.infer<typeof assistantDeltaSchema>;
export type GenerationUpdatedEvent = z.infer<typeof generationUpdatedSchema>;
export type MemberJoinedEvent = z.infer<typeof memberJoinedSchema>;

// Wire event_type strings, used by the outbox producer and publisher. The
// constructor return types are pinned to each schema's inferred type, so a
// constructor that drifts from its schema is a compile error.
export const ChatEventType = {
  AssistantDelta: "assistant_delta",
  BranchCreated: "branch_created",
  GenerationUpdated: "generation_updated",
  MemberJoined: "member_joined",
  MessageCreated: "message_created",
  MessageUpdated: "message_updated",
} as const;
