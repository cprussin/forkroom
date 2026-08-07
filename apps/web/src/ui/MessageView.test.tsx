import { describe, expect, it } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("shows a fork chip and switches variant when it is clicked", () => {
    const switches: number[] = [];
    render(
      <MessageView
        authorName="Alice"
        forkChip={{
          label: "Alice's fork",
          onSwitch: () => switches.push(1),
          position: "2/3",
        }}
        message={message({})}
      />,
    );
    const chip = screen.getByRole("button", { name: /Alice's fork/ });
    expect(chip).toHaveTextContent("2/3");
    fireEvent.click(chip);
    expect(switches).toEqual([1]);
  });

  it("shows no fork chip when the message is not on a fork", () => {
    render(<MessageView authorName="Alice" message={message({})} />);
    expect(screen.queryByText(/fork/i)).not.toBeInTheDocument();
  });
});
