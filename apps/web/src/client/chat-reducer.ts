import type {
  BranchEntity,
  GenerationEntity,
  MemberEntity,
  MessageEntity,
} from "../contracts/chat-entities";
import type { ChatEvent } from "../contracts/chat-events";

/**
 * The client's view of a chat, rebuilt from a snapshot and kept current by
 * applying realtime events. The database is authoritative; this is a cache that
 * events invalidate/update. Two properties make it robust to an unreliable
 * transport:
 *
 *   - **Idempotent**: each entity records the highest event `id` that touched
 *     it (`entityVersion`); an event with an id at or below that is ignored, so
 *     replays and duplicates are harmless.
 *   - **Order-insensitive**: entities are keyed by id and messages are sorted
 *     by `sequenceNumber` at read time, so out-of-order arrivals still produce
 *     the correct per-branch order, and a late checkpoint never loses to an
 *     earlier delta.
 */
export type ChatState = {
  branches: Readonly<Record<string, BranchEntity>>;
  messages: Readonly<Record<string, MessageEntity>>;
  generations: Readonly<Record<string, GenerationEntity>>;
  members: Readonly<Record<string, MemberEntity>>;
  entityVersion: Readonly<Record<string, number>>;
  lastEventId: number;
};

export const emptyChatState = (): ChatState => ({
  branches: {},
  entityVersion: {},
  generations: {},
  lastEventId: 0,
  members: {},
  messages: {},
});

/** Apply one realtime event to the state, returning the next state. */
export const applyEvent = (state: ChatState, event: ChatEvent): ChatState => {
  const lastEventId = Math.max(state.lastEventId, event.id);
  const target = targetOf(state, event);
  const superseded =
    target !== undefined && event.id <= (state.entityVersion[target.id] ?? 0);
  if (target === undefined || superseded) {
    return { ...state, lastEventId };
  } else {
    return {
      ...state,
      ...target.patch,
      entityVersion: { ...state.entityVersion, [target.id]: event.id },
      lastEventId,
    };
  }
};

/** Messages on a branch, ordered by sequence number regardless of arrival. */
export const messagesForBranch = (
  state: ChatState,
  branchId: string,
): MessageEntity[] =>
  Object.values(state.messages)
    .filter((message) => message.branchId === branchId)
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

/** Branches with main first, then children by creation time (PRD §6.1). */
export const branchesInBoardOrder = (state: ChatState): BranchEntity[] =>
  Object.values(state.branches).sort((a, b) => {
    if (a.isMain === b.isMain) {
      return a.createdAt.localeCompare(b.createdAt);
    } else {
      return a.isMain ? -1 : 1;
    }
  });

/**
 * Whether applying `eventId` after `cursor` would skip an event. The next
 * contiguous event is `cursor + 1`; anything beyond means the client missed
 * one and should refetch the snapshot to resync.
 */
export const detectGap = (cursor: number, eventId: number): boolean =>
  eventId > cursor + 1;

type EntityTarget = { id: string; patch: Partial<ChatState> };

const targetOf = (
  state: ChatState,
  event: ChatEvent,
): EntityTarget | undefined => {
  switch (event.type) {
    case "branch_created": {
      return {
        id: event.branch.id,
        patch: {
          branches: { ...state.branches, [event.branch.id]: event.branch },
        },
      };
    }
    case "message_created":
    case "message_updated": {
      return {
        id: event.message.id,
        patch: {
          messages: { ...state.messages, [event.message.id]: event.message },
        },
      };
    }
    case "assistant_delta": {
      const existing = state.messages[event.messageId];
      return existing === undefined
        ? undefined
        : {
            id: event.messageId,
            patch: {
              messages: {
                ...state.messages,
                [event.messageId]: {
                  ...existing,
                  content: existing.content + event.textDelta,
                  status: "streaming",
                },
              },
            },
          };
    }
    case "generation_updated": {
      return {
        id: event.generation.id,
        patch: {
          generations: {
            ...state.generations,
            [event.generation.id]: event.generation,
          },
        },
      };
    }
    case "member_joined": {
      return {
        id: event.member.userId,
        patch: {
          members: { ...state.members, [event.member.userId]: event.member },
        },
      };
    }
  }
};
