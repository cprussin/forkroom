"use client";

import { css } from "../../styled-system/css";
import type { BranchTreeNode } from "../client/branch-tree";
import type { MemberEntity } from "../contracts/chat-entities";
import { ForkNavigator } from "./ForkNavigator";
import { InviteButton } from "./InviteButton";
import { MemberStack } from "./MemberStack";

type Props = {
  title: string;
  members: MemberEntity[];
  chatId: string;
  isCreator: boolean;
  /** The chat's branches in tree order, for the persistent fork indicator. */
  branchTree: BranchTreeNode[];
  currentBranchId: string;
  ownerName: (userId: string) => string;
  onSelectBranch: (branchId: string) => void;
};

/** Chat header: the (auto-derived) title, a fork indicator, presence, and invite for the creator. */
export const TopBar = ({
  title,
  members,
  chatId,
  isCreator,
  branchTree,
  currentBranchId,
  ownerName,
  onSelectBranch,
}: Props) => (
  <header className={barStyles}>
    <div className={leadStyles}>
      <h1 className={titleStyles}>{title}</h1>
    </div>
    <div className={actionsStyles}>
      <ForkNavigator
        currentBranchId={currentBranchId}
        nodes={branchTree}
        onSelectBranch={onSelectBranch}
        ownerName={ownerName}
      />
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
