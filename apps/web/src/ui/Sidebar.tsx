"use client";

import { ThemeSwitch } from "@forkroom/component-library/ThemeSwitch";
import { NotePencilIcon } from "@phosphor-icons/react/dist/ssr/NotePencil";
import { css, cx } from "../../styled-system/css";
import type { ChatListItem } from "../contracts/chat-list";
import { SignOutButton } from "./SignOutButton";

type Props = {
  chats: ChatListItem[];
  currentChatId: string | undefined;
};

/** ChatGPT-style history rail: brand, a new-chat action, and the user's chats. */
export const Sidebar = ({ chats, currentChatId }: Props) => (
  <nav aria-label="Chats" className={rootStyles}>
    <div className={headerStyles}>
      <a className={brandStyles} href="/">
        forkroom
      </a>
      <a aria-label="New chat" className={newChatStyles} href="/">
        <NotePencilIcon />
      </a>
    </div>
    {chats.length === 0 ? (
      <p className={emptyStyles}>No chats yet. Start one below.</p>
    ) : (
      <ul className={listStyles}>
        {chats.map((chat) => (
          <li key={chat.id}>
            <a
              aria-current={chat.id === currentChatId ? "page" : undefined}
              className={cx(
                itemStyles,
                chat.id === currentChatId ? activeItemStyles : undefined,
              )}
              href={`/chats/${chat.id}`}
            >
              {chat.title}
            </a>
          </li>
        ))}
      </ul>
    )}
    <div className={footerStyles}>
      <ThemeSwitch />
      <SignOutButton />
    </div>
  </nav>
);

const rootStyles = css({
  backgroundColor: "card",
  blockSize: "100%",
  borderInlineEnd: "1px solid {colors.border}",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  inlineSize: 72,
  overflowY: "auto",
  paddingBlock: 3,
  paddingInline: 2,
});

const headerStyles = css({
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  paddingBlockEnd: 1,
  paddingInline: 2,
});

const brandStyles = css({
  color: "accent",
  fontWeight: "bold",
  letterSpacing: "tight",
});

const newChatStyles = css({
  _hover: { backgroundColor: "background", color: "foreground" },
  alignItems: "center",
  borderRadius: "md",
  color: "muted",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: "lg",
  padding: 1.5,
});

const listStyles = css({
  display: "flex",
  flex: 1,
  flexDirection: "column",
  gap: 0.5,
  minBlockSize: 0,
});

const footerStyles = css({
  alignItems: "center",
  borderBlockStart: "1px solid {colors.border}",
  display: "flex",
  gap: 2,
  justifyContent: "space-between",
  marginBlockStart: "auto",
  paddingBlockStart: 2,
  paddingInline: 2,
});

const itemStyles = css({
  _hover: { backgroundColor: "background" },
  borderRadius: "md",
  color: "foreground",
  cursor: "pointer",
  display: "block",
  fontSize: "sm",
  overflow: "hidden",
  paddingBlock: 2,
  paddingInline: 2.5,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const activeItemStyles = css({
  backgroundColor: "background",
  fontWeight: "semibold",
});

const emptyStyles = css({
  color: "muted",
  fontSize: "xs",
  paddingBlock: 2,
  paddingInline: 2.5,
});
