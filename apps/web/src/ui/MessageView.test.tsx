import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { MessageEntity } from "../contracts/chat-entities";
import { MessageView } from "./MessageView";

const message = (overrides: Partial<MessageEntity>): MessageEntity => ({
  authorUserId: "user-1",
  branchId: "branch-1",
  chatId: "chat-1",
  content: "hello",
  createdAt: "2026-01-01T00:00:00.000Z",
  id: "message-1",
  role: "user",
  sequenceNumber: 1,
  status: "completed",
  ...overrides,
});

describe("MessageView", () => {
  it("offers a fork action on a completed assistant reply", () => {
    render(
      <MessageView
        authorName="Alice"
        message={message({ authorUserId: undefined, role: "assistant" })}
        onForkFromHere={() => undefined}
      />,
    );
    expect(
      screen.getByRole("button", { name: /fork from here/i }),
    ).toBeInTheDocument();
  });

  it("does not offer a fork action on a human user's message", () => {
    render(
      <MessageView
        authorName="Alice"
        message={message({ role: "user" })}
        onForkFromHere={() => undefined}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /fork from here/i }),
    ).not.toBeInTheDocument();
  });
});
