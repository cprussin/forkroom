import { describe, expect, it } from "bun:test";
import type { BranchEntity, MessageEntity } from "../contracts/chat-entities";
import type { ChatState } from "./chat-reducer";
import { emptyChatState } from "./chat-reducer";
import { buildThreadView } from "./thread-view";

const branch = (
  id: string,
  ownerUserId: string,
  parentBranchId: string | undefined,
  forkMessageId: string | undefined,
  createdAt: string,
): BranchEntity => ({
  chatId: "chat",
  createdAt,
  createdByUserId: ownerUserId,
  forkMessageId,
  id,
  isMain: parentBranchId === undefined,
  ownerUserId,
  parentBranchId,
});

const message = (
  id: string,
  branchId: string,
  sequenceNumber: number,
): MessageEntity => ({
  authorUserId: "u",
  branchId,
  chatId: "chat",
  content: id,
  createdAt: "2026-08-06",
  id,
  role: "user",
  sequenceNumber,
  status: "completed",
});

// main: m1, m2 ; forkA (alice) and forkB (bob) both fork at m1.
const scenario = (): ChatState => {
  const branches = [
    branch("main", "creator", undefined, undefined, "t0"),
    branch("forkA", "alice", "main", "m1", "t1"),
    branch("forkB", "bob", "main", "m1", "t2"),
  ];
  const messages = [
    message("m1", "main", 1),
    message("m2", "main", 2),
    message("fa1", "forkA", 1),
    message("fb1", "forkB", 1),
  ];
  return {
    ...emptyChatState(),
    branches: Object.fromEntries(branches.map((b) => [b.id, b])),
    messages: Object.fromEntries(messages.map((m) => [m.id, m])),
  };
};

describe("buildThreadView", () => {
  it("returns an empty thread for an unknown leaf branch", () => {
    expect(buildThreadView(emptyChatState(), "nope")).toStrictEqual([]);
  });

  it("lists the linear path for the selected leaf", () => {
    const view = buildThreadView(scenario(), "forkA");
    expect(view.map((entry) => entry.message.id)).toStrictEqual(["m1", "fa1"]);
  });

  it("surfaces a fork switch only on messages that were forked", () => {
    const view = buildThreadView(scenario(), "main");
    const m1 = view.find((entry) => entry.message.id === "m1");
    const m2 = view.find((entry) => entry.message.id === "m2");
    expect(m2?.fork).toBeUndefined();
    expect(m1?.fork?.variants.map((v) => v.branchId)).toStrictEqual([
      "main",
      "forkA",
      "forkB",
    ]);
  });

  it("marks the trunk active when the path continues on the parent branch", () => {
    const view = buildThreadView(scenario(), "main");
    const m1 = view.find((entry) => entry.message.id === "m1");
    expect(m1?.fork?.activeBranchId).toBe("main");
  });

  it("marks the followed fork active when the path took a fork", () => {
    const view = buildThreadView(scenario(), "forkA");
    const m1 = view.find((entry) => entry.message.id === "m1");
    expect(m1?.fork?.activeBranchId).toBe("forkA");
  });
});
