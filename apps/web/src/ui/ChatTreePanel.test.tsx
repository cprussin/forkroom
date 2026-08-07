import { describe, expect, it } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  BranchEntity,
  MemberEntity,
  MessageEntity,
} from "../contracts/chat-entities";
import { ChatTreePanel } from "./ChatTreePanel";

const member = (id: string, displayName: string): MemberEntity => ({
  avatarUrl: undefined,
  displayName,
  role: "participant",
  userId: id,
});

const members: Record<string, MemberEntity> = {
  alice: member("alice", "Alice"),
  bob: member("bob", "Bob"),
  dana: member("dana", "Dana"),
};

const message = (
  id: string,
  branchId: string,
  sequenceNumber: number,
  role: MessageEntity["role"],
  authorUserId: string | undefined,
): MessageEntity => ({
  authorUserId,
  branchId,
  chatId: "chat",
  content: "…",
  createdAt: "2026-08-07T00:00:00Z",
  id,
  role,
  sequenceNumber,
  status: "completed",
});

const messages: MessageEntity[] = [
  message("m1", "main", 1, "user", "dana"),
  message("m2", "main", 2, "assistant", undefined),
  message("a1", "forkA", 1, "user", "alice"),
  message("b1", "forkB", 1, "user", "bob"),
];

const branch = (
  id: string,
  isMain: boolean,
  forkMessageId: string | undefined,
  createdAt: string,
): BranchEntity => ({
  chatId: "chat",
  createdAt,
  createdByUserId: "u",
  forkMessageId,
  id,
  isMain,
  ownerUserId: "u",
  parentBranchId: isMain ? undefined : "main",
});

const branches: BranchEntity[] = [
  branch("main", true, undefined, "2026-08-01"),
  branch("forkA", false, "m2", "2026-08-02"),
  branch("forkB", false, "m2", "2026-08-03"),
];

describe("ChatTreePanel", () => {
  it("draws a node for every message, the assistant reply included", () => {
    render(
      <ChatTreePanel
        activeMessageIds={["m1", "m2"]}
        branches={branches}
        currentMessageId="m2"
        members={members}
        messages={messages}
        onSelectMessage={() => undefined}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: "Assistant" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bob" })).toBeInTheDocument();
  });

  it("jumps to a message and its branch when its node is chosen", () => {
    const selected: [string, string][] = [];
    render(
      <ChatTreePanel
        activeMessageIds={["m1", "m2"]}
        branches={branches}
        currentMessageId="m2"
        members={members}
        messages={messages}
        onSelectMessage={(branchId, messageId) => {
          selected.push([branchId, messageId]);
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Bob" }));
    expect(selected).toEqual([["forkB", "b1"]]);
  });

  it("marks the message currently in focus and no other", () => {
    render(
      <ChatTreePanel
        activeMessageIds={["m1", "m2", "a1"]}
        branches={branches}
        currentMessageId="a1"
        members={members}
        messages={messages}
        onSelectMessage={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Alice" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "Bob" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders the hovered node's message as markdown", async () => {
    const user = userEvent.setup();
    const withMarkdown: MessageEntity[] = [
      message("m1", "main", 1, "user", "dana"),
      message("m2", "main", 2, "assistant", undefined),
      { ...message("a1", "forkA", 1, "user", "alice"), content: "**bold**" },
      message("b1", "forkB", 1, "user", "bob"),
    ];
    render(
      <ChatTreePanel
        activeMessageIds={["m1", "m2"]}
        branches={branches}
        currentMessageId="m2"
        members={members}
        messages={withMarkdown}
        onSelectMessage={() => undefined}
      />,
    );
    await user.hover(screen.getByRole("button", { name: "Alice" }));
    const emphasised = await screen.findByText("bold");
    expect(emphasised.tagName).toBe("STRONG");
  });

  it("renders nothing when the chat has no forks", () => {
    const { container } = render(
      <ChatTreePanel
        activeMessageIds={["m1"]}
        branches={[branch("main", true, undefined, "2026-08-01")]}
        currentMessageId="m1"
        members={members}
        messages={[message("m1", "main", 1, "user", "dana")]}
        onSelectMessage={() => undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
