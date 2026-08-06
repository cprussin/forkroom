import { describe, expect, it } from "bun:test";
import { branchEntitySchema, messageEntitySchema } from "./chat-entities";

// Emulate the server→browser wire: JSON drops keys whose value is `undefined`,
// which nullable fields become after the server parses a DB NULL.
const overWire = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe("nullable entity fields survive the JSON wire round-trip", () => {
  it("parses a branch whose nullable fields arrive as null, then as a dropped key", () => {
    const row = {
      chatId: "chat",
      createdAt: "2026-08-06T00:00:00.000Z",
      createdByUserId: "u",
      forkMessageId: null,
      id: "b",
      isMain: true,
      ownerUserId: "u",
      parentBranchId: null,
    };

    const parsed = branchEntitySchema.parse(row);
    expect(parsed.forkMessageId).toBeUndefined();
    expect(parsed.parentBranchId).toBeUndefined();

    // The parsed entity, re-serialized, has NO forkMessageId/parentBranchId key
    // at all — the browser must still accept it.
    const reparsed = branchEntitySchema.parse(overWire(parsed));
    expect(reparsed.forkMessageId).toBeUndefined();
    expect(reparsed.parentBranchId).toBeUndefined();
  });

  it("parses an assistant message whose authorUserId is dropped over the wire", () => {
    const row = {
      authorUserId: null,
      branchId: "b",
      chatId: "chat",
      content: "hi",
      createdAt: "2026-08-06T00:00:00.000Z",
      id: "m",
      role: "assistant" as const,
      sequenceNumber: 2,
      status: "completed" as const,
    };

    const reparsed = messageEntitySchema.parse(
      overWire(messageEntitySchema.parse(row)),
    );
    expect(reparsed.authorUserId).toBeUndefined();
    expect(reparsed.content).toBe("hi");
  });

  it("still preserves a present string value across the wire", () => {
    const row = {
      chatId: "chat",
      createdAt: "2026-08-06T00:00:00.000Z",
      createdByUserId: "u",
      forkMessageId: "fork-msg",
      id: "b",
      isMain: false,
      ownerUserId: "u",
      parentBranchId: "main",
    };
    const reparsed = branchEntitySchema.parse(
      overWire(branchEntitySchema.parse(row)),
    );
    expect(reparsed.forkMessageId).toBe("fork-msg");
    expect(reparsed.parentBranchId).toBe("main");
  });
});
