import type { ReactNode } from "react";
import { css } from "../../styled-system/css";
import type { ChatListItem } from "../contracts/chat-list";
import { Sidebar } from "./Sidebar";

type Props = {
  chats: ChatListItem[];
  currentChatId: string | undefined;
  children: ReactNode;
};

/** The signed-in two-pane layout: the chat-history sidebar beside the main view. */
export const AppShell = ({ chats, currentChatId, children }: Props) => (
  <div className={shellStyles}>
    <Sidebar chats={chats} currentChatId={currentChatId} />
    <main className={mainStyles}>{children}</main>
  </div>
);

const shellStyles = css({
  blockSize: "100dvh",
  display: "flex",
  overflow: "hidden",
});

const mainStyles = css({
  display: "flex",
  flex: 1,
  flexDirection: "column",
  minInlineSize: 0,
});
