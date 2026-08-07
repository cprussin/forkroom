import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { MessageEntity } from "../contracts/chat-entities";
import { MessageView } from "./MessageView";

const message: MessageEntity = {
  authorUserId: "alice",
  branchId: "main",
  chatId: "chat",
  content: "Hello world",
  createdAt: "2026-08-07T00:00:00Z",
  id: "m1",
  role: "assistant",
  sequenceNumber: 1,
  status: "completed",
};

describe("MessageView", () => {
  it("renders the message content", () => {
    render(<MessageView authorName="Alice" message={message} />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  describe("fork marker", () => {
    it("badges a message that has several versions", () => {
      render(
        <MessageView authorName="Alice" forkCount={3} message={message} />,
      );
      expect(screen.getByText("3 versions")).toBeInTheDocument();
    });

    it("badges the exact number of versions it is given", () => {
      render(
        <MessageView authorName="Alice" forkCount={2} message={message} />,
      );
      expect(screen.getByText("2 versions")).toBeInTheDocument();
    });

    it("marks the article as a branch point when forked", () => {
      render(
        <MessageView authorName="Alice" forkCount={2} message={message} />,
      );
      expect(screen.getByRole("article")).toHaveAttribute("data-forked", "");
    });

    it("shows no fork marker when the message is not a branch point", () => {
      render(<MessageView authorName="Alice" message={message} />);
      expect(screen.queryByText(/versions/)).not.toBeInTheDocument();
      expect(screen.getByRole("article")).not.toHaveAttribute("data-forked");
    });
  });
});
