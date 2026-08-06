"use client";

import { useState } from "react";
import { css, cx } from "../../styled-system/css";
import { selectBranchView } from "../client/branch-view";
import type { ChatState } from "../client/chat-reducer";
import type { BranchEntity } from "../contracts/chat-entities";
import { MessageView } from "./MessageView";

type Props = {
  state: ChatState;
  branch: BranchEntity;
  selected: boolean;
  onSelect: (branchId: string) => void;
  memberName: (userId: string | undefined) => string;
};

/**
 * One branch rendered as a board column: a sticky header identifying the branch
 * (owner, parent, fork point), the collapsible inherited context, a fork
 * divider, and the branch's local messages.
 */
export const BranchColumn = ({
  state,
  branch,
  selected,
  onSelect,
  memberName,
}: Props) => {
  const { inherited, local } = selectBranchView(state, branch.id);
  const [showInherited, setShowInherited] = useState(false);
  const parent =
    branch.parentBranchId === undefined
      ? undefined
      : state.branches[branch.parentBranchId];

  return (
    <section
      aria-label={
        branch.isMain
          ? "Main branch"
          : `Branch by ${memberName(branch.ownerUserId)}`
      }
      className={cx(columnStyles, selected ? selectedStyles : undefined)}
    >
      <header className={headerStyles}>
        <div className={titleRowStyles}>
          <button
            className={titleButtonStyles}
            onClick={() => {
              onSelect(branch.id);
            }}
            type="button"
          >
            {branch.isMain
              ? "Main"
              : `${memberName(branch.ownerUserId)}'s branch`}
          </button>
          {selected ? (
            <span className={activeBadgeStyles}>active</span>
          ) : undefined}
        </div>
        {parent === undefined ? (
          <p className={metaStyles}>Root conversation</p>
        ) : (
          <p className={metaStyles}>
            Forked from{" "}
            {parent.isMain
              ? "Main"
              : `${memberName(parent.ownerUserId)}'s branch`}
          </p>
        )}
      </header>

      <div className={messagesStyles}>
        {inherited.length > 0 ? (
          <div>
            <button
              aria-expanded={showInherited}
              className={inheritedToggleStyles}
              onClick={(event) => {
                event.stopPropagation();
                setShowInherited((value) => !value);
              }}
              type="button"
            >
              {showInherited
                ? "Hide inherited context"
                : `Show inherited context (${inherited.length.toString()})`}
            </button>
            {showInherited
              ? inherited.map((message) => (
                  <MessageView
                    authorName={memberName(message.authorUserId)}
                    key={message.id}
                    message={message}
                    subdued
                  />
                ))
              : undefined}
            <div className={dividerStyles}>
              <span className={dividerLabelStyles}>fork point</span>
            </div>
          </div>
        ) : undefined}

        {local.length === 0 && inherited.length === 0 ? (
          <p className={emptyStyles}>No messages yet.</p>
        ) : (
          local.map((message) => (
            <MessageView
              authorName={memberName(message.authorUserId)}
              key={message.id}
              message={message}
            />
          ))
        )}
      </div>
    </section>
  );
};

const columnStyles = css({
  backgroundColor: "background",
  border: "1px solid {colors.border}",
  borderRadius: "lg",
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  inlineSize: 108,
  maxBlockSize: "100%",
  maxInlineSize: "92vw",
  overflow: "hidden",
});

const selectedStyles = css({
  borderColor: "accent",
  boxShadow: "lifted",
});

const headerStyles = css({
  backgroundColor: "card",
  borderBlockEnd: "1px solid {colors.border}",
  display: "flex",
  flexDirection: "column",
  gap: 0.5,
  insetBlockStart: 0,
  paddingBlock: 2,
  paddingInline: 3,
  position: "sticky",
});

const titleRowStyles = css({ alignItems: "center", display: "flex", gap: 2 });

const titleButtonStyles = css({
  background: "none",
  color: "foreground",
  cursor: "pointer",
  fontSize: "sm",
  fontWeight: "bold",
  textAlign: "start",
});

const activeBadgeStyles = css({
  backgroundColor: "accent",
  borderRadius: "full",
  color: "background",
  fontSize: "xs",
  fontWeight: "semibold",
  paddingBlock: 0.25,
  paddingInline: 1.5,
});

const metaStyles = css({ color: "muted", fontSize: "xs" });

const messagesStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: 1.5,
  overflowY: "auto",
  padding: 2,
});

const inheritedToggleStyles = css({
  background: "none",
  color: "accent",
  cursor: "pointer",
  fontSize: "xs",
  paddingBlock: 1,
});

const dividerStyles = css({
  _after: {
    backgroundColor: "border",
    blockSize: "1px",
    content: '""',
    flex: 1,
  },
  _before: {
    backgroundColor: "border",
    blockSize: "1px",
    content: '""',
    flex: 1,
  },
  alignItems: "center",
  color: "muted",
  display: "flex",
  gap: 2,
  marginBlock: 1,
});

const dividerLabelStyles = css({
  fontSize: "xs",
  letterSpacing: "wide",
  textTransform: "uppercase",
});

const emptyStyles = css({ color: "muted", fontSize: "sm", padding: 2 });
