"use client";

import { ThemeSwitch } from "@forkroom/component-library/ThemeSwitch";
import { css } from "../../styled-system/css";
import { InviteButton } from "./InviteButton";
import { SignOutButton } from "./SignOutButton";

type Props = {
  title: string;
  memberCount: number;
  chatId: string;
  isCreator: boolean;
};

/** Persistent top bar: title, presence, invite (creator), theme, and account. */
export const TopBar = ({ title, memberCount, chatId, isCreator }: Props) => (
  <header className={barStyles}>
    <div className={leadStyles}>
      <a className={brandStyles} href="/">
        forkroom
      </a>
      <h1 className={titleStyles}>{title}</h1>
    </div>
    <div className={actionsStyles}>
      <span className={presenceStyles}>
        {memberCount} {memberCount === 1 ? "member" : "members"}
      </span>
      {isCreator ? <InviteButton chatId={chatId} /> : undefined}
      <ThemeSwitch />
      <SignOutButton />
    </div>
  </header>
);

const barStyles = css({
  alignItems: "center",
  backgroundColor: "card",
  borderBlockEnd: "1px solid {colors.border}",
  display: "flex",
  gap: 4,
  justifyContent: "space-between",
  paddingBlock: 2,
  paddingInline: 4,
});

const leadStyles = css({
  alignItems: "baseline",
  display: "flex",
  gap: 3,
  minInlineSize: 0,
});

const brandStyles = css({
  color: "accent",
  fontWeight: "bold",
  letterSpacing: "tight",
});

const titleStyles = css({
  color: "foreground",
  fontSize: "lg",
  fontWeight: "semibold",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const actionsStyles = css({ alignItems: "center", display: "flex", gap: 2 });

const presenceStyles = css({ color: "muted", fontSize: "sm" });
