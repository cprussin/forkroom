import { describe, expect, it } from "bun:test";
import type { ContextMessage } from "../domain/context";
import { toModelMessages } from "./to-model-messages";

const message = (
  id: string,
  role: ContextMessage["role"],
  content: string,
  status: ContextMessage["status"] = "completed",
): ContextMessage => ({
  branchId: "b",
  content,
  id,
  role,
  sequenceNumber: 1,
  status,
});

describe("toModelMessages", () => {
  it("prepends the system prompt and keeps completed turns in order", () => {
    const result = toModelMessages(
      [message("m1", "user", "hi"), message("m2", "assistant", "hello")],
      "SYS",
    );
    expect(result).toStrictEqual([
      { content: "SYS", role: "system" },
      { content: "hi", role: "user" },
      { content: "hello", role: "assistant" },
    ]);
  });

  it("drops non-completed messages (placeholders, failures)", () => {
    const result = toModelMessages(
      [
        message("m1", "user", "hi"),
        message("m2", "assistant", "", "queued"),
        message("m3", "assistant", "partial", "streaming"),
      ],
      "SYS",
    );
    expect(result.map((m) => m.content)).toStrictEqual(["SYS", "hi"]);
  });
});
