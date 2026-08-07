"use client";

import { Avatar } from "@forkroom/component-library/Avatar";
import { Popover } from "@forkroom/component-library/Popover";
import { css } from "../../styled-system/css";
import { hstack, vstack } from "../../styled-system/patterns";
import type { MemberEntity } from "../contracts/chat-entities";

// The header has room for only a few overlapping avatars; beyond this the
// count carries the rest and the full roster lives in the hover popover.
const MAX_STACK = 5;

/**
 * The chat's member presence: a collapsed stack of member avatars beside the
 * count, revealing the full roster (each member's avatar and name) in a
 * popover on hover.
 */
export const MemberStack = ({ members }: { members: MemberEntity[] }) => {
  const shown = members.slice(0, MAX_STACK);
  return (
    <Popover
      openOnHover
      trigger={
        <button className={triggerStyles} type="button">
          <span className={stackStyles}>
            {shown.map((member) => (
              <span className={ringStyles} key={member.userId}>
                <Avatar
                  name={member.displayName}
                  size="2xs"
                  src={member.avatarUrl}
                />
              </span>
            ))}
          </span>
          <span className={countStyles}>
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        </button>
      }
    >
      <ul className={listStyles}>
        {members.map((member) => (
          <li className={itemStyles} key={member.userId}>
            <Avatar
              name={member.displayName}
              size="xs"
              src={member.avatarUrl}
            />
            <span className={nameStyles}>{member.displayName}</span>
          </li>
        ))}
      </ul>
    </Popover>
  );
};

const triggerStyles = hstack({
  _hover: { color: "foreground" },
  background: "none",
  borderRadius: "md",
  color: "muted",
  cursor: "pointer",
  gap: 2,
  paddingBlock: 1,
  paddingInline: 1,
});

const stackStyles = css({ alignItems: "center", display: "flex" });

// Each avatar sits under a card-colored ring so the overlap reads as
// distinct disks; all but the first pull left to overlap their neighbor.
const ringStyles = css({
  "&:not(:first-child)": { marginInlineStart: -2 },
  borderRadius: "full",
  boxShadow: "0 0 0 {spacing.0.5} {colors.card}",
});

const countStyles = css({ fontSize: "sm", whiteSpace: "nowrap" });

const listStyles = vstack({
  alignItems: "stretch",
  gap: 1,
  listStyleType: "none",
  margin: 0,
  maxBlockSize: "20rem",
  minInlineSize: "12rem",
  overflowY: "auto",
  padding: 2,
});

const itemStyles = hstack({
  borderRadius: "md",
  gap: 2,
  paddingBlock: 1,
  paddingInline: 2,
});

const nameStyles = css({
  color: "foreground",
  fontSize: "sm",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
