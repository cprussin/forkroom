"use client";

import { Avatar } from "@forkroom/component-library/Avatar";
import { GitForkIcon } from "@phosphor-icons/react/dist/ssr/GitFork";
import { css } from "../../styled-system/css";
import type { ForkSwitch, ForkVariant } from "../client/thread-view";
import { forkLabel } from "./fork-label";

type Props = {
  fork: ForkSwitch;
  memberName: (userId: string | undefined) => string;
  /** The owner's own display name, used for avatar initials — unlike
   * `memberName` it never substitutes "You" or a role placeholder. */
  ownerName: (userId: string) => string;
  onSelectBranch: (branchId: string) => void;
};

/**
 * The fork point rendered as a stack of overlapping cards — one per variant
 * that continues past this message, the trunk plus every collaborator's fork.
 * Each card peeks its owner's avatar from under the one in front; the active
 * variant is lifted to the top. Clicking any card's exposed edge switches the
 * displayed thread to that variant, so the branch is obvious right in the
 * stream rather than hidden behind a subtle control.
 */
export const ForkStack = ({
  fork,
  memberName,
  ownerName,
  onSelectBranch,
}: Props) => {
  const activeIndex = fork.variants.findIndex(
    (variant) => variant.branchId === fork.activeBranchId,
  );
  return (
    <div aria-label="Switch forks" className={rootStyles} role="group">
      <div className={captionStyles}>
        <GitForkIcon weight="bold" />
        <span className={countStyles}>
          {fork.variants.length.toString()} versions
        </span>
        <span className={hintStyles}>· click a card to switch</span>
      </div>
      <div className={stackStyles}>
        {fork.variants.map((variant) => {
          const isActive = variant.branchId === fork.activeBranchId;
          const label = variantLabel(variant, memberName);
          return (
            <button
              aria-current={isActive ? "true" : undefined}
              aria-label={label}
              className={cardStyles}
              data-active={isActive ? "" : undefined}
              key={variant.branchId}
              onClick={() => {
                onSelectBranch(variant.branchId);
              }}
              title={label}
              type="button"
            >
              <span className={cardAvatarStyles}>
                <Avatar name={ownerName(variant.ownerUserId)} size="2xs" />
              </span>
              <span className={cardLabelStyles}>{label}</span>
            </button>
          );
        })}
      </div>
      <span className={positionStyles}>
        {(activeIndex + 1).toString()} / {fork.variants.length.toString()}
      </span>
    </div>
  );
};

const variantLabel = (
  variant: ForkVariant,
  memberName: (userId: string | undefined) => string,
): string =>
  variant.isMain ? "Main" : forkLabel(memberName(variant.ownerUserId));

// The stack sticks to the top of the conversation while its branch's messages
// are on screen, so the fork stays visible — and switchable — even when you've
// scrolled deep into a long branched reply. An opaque background occludes the
// messages scrolling behind it.
const rootStyles = css({
  alignItems: "flex-start",
  alignSelf: "stretch",
  backgroundColor: "background",
  display: "flex",
  flexDirection: "column",
  gap: 1,
  insetBlockStart: 0,
  paddingBlock: 1.5,
  paddingInline: 1,
  position: "sticky",
  zIndex: 1,
});

const captionStyles = css({
  alignItems: "center",
  color: "accent",
  display: "flex",
  fontSize: "xs",
  fontWeight: "semibold",
  gap: 1,
});

const countStyles = css({ whiteSpace: "nowrap" });

const hintStyles = css({ color: "muted", fontWeight: "normal" });

const stackStyles = css({
  alignItems: "center",
  display: "flex",
  // Extra block padding so a lifted card is never clipped by the row bounds.
  paddingBlock: 1.5,
});

// Cards overlap so each peeks its owner's avatar from under the next; the
// active (and hovered) card lifts to the top so it reads as the front of the
// deck. Opaque backgrounds keep the overlap legible.
const cardStyles = css({
  "&:hover:not([data-active])": {
    transform: "translateY(-{spacing.1})",
    zIndex: 1,
  },
  "&:not(:first-child)": { marginInlineStart: -32 },
  "&[data-active]": {
    borderColor: "accent",
    boxShadow: "lifted",
    transform: "translateY(-{spacing.1.5})",
    zIndex: 2,
  },
  alignItems: "center",
  backgroundColor: "card",
  border: "1px solid {colors.border}",
  borderRadius: "lg",
  cursor: "pointer",
  display: "flex",
  gap: 2,
  inlineSize: 40,
  overflow: "hidden",
  paddingBlock: 2,
  paddingInline: 2.5,
  position: "relative",
  textAlign: "start",
  transition: "transform {durations.fast} {easings.out}",
});

const cardAvatarStyles = css({ display: "inline-flex", flexShrink: 0 });

const cardLabelStyles = css({
  color: "foreground",
  fontSize: "sm",
  fontWeight: "semibold",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const positionStyles = css({
  color: "muted",
  fontSize: "xs",
  paddingInline: 1,
});
