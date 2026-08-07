import { describe, expect, it } from "bun:test";
import { buildChatTree, chatHasForks } from "./chat-tree";

type TestMessage = {
  authorUserId: string | undefined;
  branchId: string;
  id: string;
  role: "user" | "assistant" | "system";
  sequenceNumber: number;
};

const message = (
  id: string,
  branchId: string,
  sequenceNumber: number,
  role: "user" | "assistant" | "system",
): TestMessage => ({
  authorUserId: role === "assistant" ? undefined : id,
  branchId,
  id,
  role,
  sequenceNumber,
});

// main: m1 (user) -> m2 (assistant) -> m3 (user), with two forks off m2.
const messages: TestMessage[] = [
  message("m1", "main", 1, "user"),
  message("m2", "main", 2, "assistant"),
  message("m3", "main", 3, "user"),
  message("a1", "forkA", 1, "user"),
  message("b1", "forkB", 1, "user"),
];

const branches = [
  { createdAt: "2026-08-01", forkMessageId: undefined, id: "main" },
  { createdAt: "2026-08-02", forkMessageId: "m2", id: "forkA" },
  { createdAt: "2026-08-03", forkMessageId: "m2", id: "forkB" },
];

const nodeFor = (tree: ReturnType<typeof buildChatTree>, id: string) =>
  tree.nodes.find((node) => node.messageId === id);

describe("buildChatTree", () => {
  it("emits a node for every message", () => {
    const tree = buildChatTree(messages, branches);
    expect(tree.nodes.map((node) => node.messageId).sort()).toEqual([
      "a1",
      "b1",
      "m1",
      "m2",
      "m3",
    ]);
  });

  it("chains a branch's messages and hangs forks off the fork message", () => {
    const tree = buildChatTree(messages, branches);
    expect(tree.edges).toContainEqual({
      fromMessageId: "m1",
      toMessageId: "m2",
    });
    expect(tree.edges).toContainEqual({
      fromMessageId: "m2",
      toMessageId: "m3",
    });
    expect(tree.edges).toContainEqual({
      fromMessageId: "m2",
      toMessageId: "a1",
    });
    expect(tree.edges).toContainEqual({
      fromMessageId: "m2",
      toMessageId: "b1",
    });
  });

  it("deepens by one level per message down a branch", () => {
    const tree = buildChatTree(messages, branches);
    expect(nodeFor(tree, "m1")?.depth).toBe(0);
    expect(nodeFor(tree, "m2")?.depth).toBe(1);
    expect(nodeFor(tree, "a1")?.depth).toBe(2);
    expect(nodeFor(tree, "b1")?.depth).toBe(2);
  });

  it("spreads the fork's children across distinct columns", () => {
    const tree = buildChatTree(messages, branches);
    const columns = [
      nodeFor(tree, "m3")?.column,
      nodeFor(tree, "a1")?.column,
      nodeFor(tree, "b1")?.column,
    ];
    expect(new Set(columns).size).toBe(3);
  });

  it("centres a fork message over its children", () => {
    const tree = buildChatTree(messages, branches);
    const children = [
      nodeFor(tree, "m3")?.column ?? 0,
      nodeFor(tree, "a1")?.column ?? 0,
      nodeFor(tree, "b1")?.column ?? 0,
    ];
    const parent = nodeFor(tree, "m2")?.column ?? -1;
    expect(parent).toBeGreaterThanOrEqual(Math.min(...children));
    expect(parent).toBeLessThanOrEqual(Math.max(...children));
  });

  it("preserves the assistant role and absent author on its node", () => {
    const tree = buildChatTree(messages, branches);
    expect(nodeFor(tree, "m2")?.role).toBe("assistant");
    expect(nodeFor(tree, "m2")?.authorUserId).toBeUndefined();
  });
});

describe("chatHasForks", () => {
  it("is true once a non-main branch exists", () => {
    expect(chatHasForks([{ isMain: true }, { isMain: false }])).toBe(true);
  });

  it("is false for a chat with only its main branch", () => {
    expect(chatHasForks([{ isMain: true }])).toBe(false);
  });
});
