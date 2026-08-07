import { describe, expect, it } from "bun:test";
import { Provider } from "@forkroom/component-library/Provider";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { ChatListItem } from "../contracts/chat-list";
import { Sidebar } from "./Sidebar";

const chats: ChatListItem[] = [
  { id: "a", lastActivityAt: "2026-08-07T02:00:00Z", title: "First chat" },
  { id: "b", lastActivityAt: "2026-08-07T01:00:00Z", title: "Second chat" },
];

// The account footer's ThemeSwitch reads the library's theme context.
const withProvider = (node: ReactNode) => <Provider>{node}</Provider>;

describe("Sidebar", () => {
  it("links each chat to its page", () => {
    render(withProvider(<Sidebar chats={chats} currentChatId="b" />));
    expect(screen.getByRole("link", { name: "First chat" })).toHaveAttribute(
      "href",
      "/chats/a",
    );
  });

  it("marks the active chat as current", () => {
    render(withProvider(<Sidebar chats={chats} currentChatId="b" />));
    expect(screen.getByRole("link", { name: "Second chat" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "First chat" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("offers a new-chat link", () => {
    render(withProvider(<Sidebar chats={chats} currentChatId={undefined} />));
    expect(screen.getByRole("link", { name: /new chat/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("shows an empty state with no chats", () => {
    render(withProvider(<Sidebar chats={[]} currentChatId={undefined} />));
    expect(screen.getByText(/no chats yet/i)).toBeInTheDocument();
  });
});
