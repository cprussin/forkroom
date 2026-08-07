"use client";

import { css } from "../../styled-system/css";
import type { MemberEntity } from "../contracts/chat-entities";
import { InviteButton } from "./InviteButton";
import { MemberStack } from "./MemberStack";

type Props = {
  title: string;
  members: MemberEntity[];
  chatId: string;
  isCreator: boolean;
};

/** Chat header: the (auto-derived) title, presence, and invite for the creator. */
export const TopBar = ({ title, members, chatId, isCreator }: Props) => (
  <header className={barStyles}>
    <div className={leadStyles}>
      <h1 className={titleStyles}>{title}</h1>
    </div>
    <div className={actionsStyles}>
      <MemberStack members={members} />
      {isCreator ? <InviteButton chatId={chatId} /> : undefined}
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

const titleStyles = css({
  color: "foreground",
  fontSize: "lg",
  fontWeight: "semibold",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const actionsStyles = css({ alignItems: "center", display: "flex", gap: 2 });
