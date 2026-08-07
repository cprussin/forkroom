import { describe, expect, it } from "bun:test";
import type { MessageEntity } from "../contracts/chat-entities";
import type { ChatEvent } from "../contracts/chat-events";
import {
  applyEvent,
  detectGap,
  emptyChatState,
  messagesForBranch,
} from "./chat-reducer";

const message = (
  id: string,
  branchId: string,
  sequenceNumber: number,
  content: string,
  status: MessageEntity["status"] = "completed",
): MessageEntity => ({
  authorUserId: "u",
  branchId,
  chatId: "chat",
  content,
  createdAt: "2026-08-06",
  id,
  role: "user",
  sequenceNumber,
  status,
});

const messageEvent = (
  id: number,
  type: "message_created" | "message_updated",
  msg: MessageEntity,
): ChatEvent => ({ chatId: "chat", id, message: msg, type });

describe("applyEvent", () => {
  it("is idempotent: applying the same event twice is harmless", () => {
    const event = messageEvent(
      1,
      "message_created",
      message("m1", "main", 1, "hi"),
    );
    const once = applyEvent(emptyChatState(), event);
    const twice = applyEvent(once, event);
    expect(messagesForBranch(twice, "main")).toStrictEqual(
      messagesForBranch(once, "main"),
    );
    expect(twice.messages.m1?.content).toBe("hi");
  });

  it("does not let an older event overwrite a newer one (out of order)", () => {
    const newer = messageEvent(
      9,
      "message_updated",
      message("m1", "main", 1, "Hello"),
    );
    const older = messageEvent(
      5,
      "message_created",
      message("m1", "main", 1, ""),
    );
    const state = applyEvent(applyEvent(emptyChatState(), newer), older);
    expect(state.messages.m1?.content).toBe("Hello");
    expect(state.lastEventId).toBe(9);
  });

  it("orders messages by sequence number regardless of arrival order", () => {
    const s1 = applyEvent(
      emptyChatState(),
      messageEvent(2, "message_created", message("m2", "main", 2, "second")),
    );
    const s2 = applyEvent(
      s1,
      messageEvent(1, "message_created", message("m1", "main", 1, "first")),
    );
    expect(messagesForBranch(s2, "main").map((m) => m.id)).toStrictEqual([
      "m1",
      "m2",
    ]);
  });

  it("appends assistant deltas and ignores replays", () => {
    const created = applyEvent(
      emptyChatState(),
      messageEvent(
        1,
        "message_created",
        message("a1", "main", 2, "", "streaming"),
      ),
    );
    const delta = (id: number, textDelta: string): ChatEvent => ({
      branchId: "main",
      chatId: "chat",
      id,
      messageId: "a1",
      textDelta,
      type: "assistant_delta",
    });
    const streamed = applyEvent(
      applyEvent(created, delta(2, "He")),
      delta(3, "llo"),
    );
    expect(streamed.messages.a1?.content).toBe("Hello");
    // Replaying an earlier delta must not double-append.
    const replayed = applyEvent(streamed, delta(2, "He"));
    expect(replayed.messages.a1?.content).toBe("Hello");
  });

  it("tracks the highest event id even for superseded events", () => {
    const state = applyEvent(
      applyEvent(
        emptyChatState(),
        messageEvent(10, "message_updated", message("m1", "main", 1, "x")),
      ),
      messageEvent(4, "message_created", message("m1", "main", 1, "")),
    );
    expect(state.lastEventId).toBe(10);
  });
});

describe("detectGap", () => {
  it("flags a skipped event and accepts a contiguous one", () => {
    expect(detectGap(5, 6)).toBe(false);
    expect(detectGap(5, 8)).toBe(true);
  });
});
