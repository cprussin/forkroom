"use client";

import { Avatar } from "@forkroom/component-library/Avatar";
import { Button } from "@forkroom/component-library/Button";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
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
 * ChatGPT-style variant navigation for a forked message: a facepile showing
 * who continues past this point — the trunk plus every collaborator's fork —
 * with carets to step through them and switch the displayed thread. The active
 * variant's owner is emphasised in the facepile.
 */
export const ForkSwitcher = ({
  fork,
  memberName,
  ownerName,
  onSelectBranch,
}: Props) => {
  const activeIndex = fork.variants.findIndex(
    (variant) => variant.branchId === fork.activeBranchId,
  );
  const active = fork.variants[activeIndex];
  const previous = fork.variants[activeIndex - 1];
  const next = fork.variants[activeIndex + 1];

  return (
    <div aria-label="Switch forks" className={rootStyles} role="group">
      <span className={leadStyles}>
        <GitForkIcon weight="bold" />
        {`${fork.variants.length.toString()} versions`}
      </span>
      <span className={facepileStyles}>
        {fork.variants.map((variant) => {
          const isActive = variant.branchId === fork.activeBranchId;
          const label = variantLabel(variant, memberName);
          return (
            <button
              aria-current={isActive ? "true" : undefined}
              aria-label={label}
              className={avatarSlotStyles}
              data-active={isActive ? "" : undefined}
              key={variant.branchId}
              onClick={() => {
                onSelectBranch(variant.branchId);
              }}
              title={label}
              type="button"
            >
              <Avatar name={ownerName(variant.ownerUserId)} size="2xs" />
            </button>
          );
        })}
      </span>
      <Button
        disabled={previous === undefined}
        label="Previous fork"
        onClick={() => {
          if (previous !== undefined) {
            onSelectBranch(previous.branchId);
          }
        }}
        size="xs"
        variant="ghost"
      >
        <CaretLeftIcon />
      </Button>
      <span className={labelStyles}>
        {active === undefined ? "" : variantLabel(active, memberName)}
        <span className={positionStyles}>
          {(activeIndex + 1).toString()} / {fork.variants.length.toString()}
        </span>
      </span>
      <Button
        disabled={next === undefined}
        label="Next fork"
        onClick={() => {
          if (next !== undefined) {
            onSelectBranch(next.branchId);
          }
        }}
        size="xs"
        variant="ghost"
      >
        <CaretRightIcon />
      </Button>
    </div>
  );
};

const variantLabel = (
  variant: ForkVariant,
  memberName: (userId: string | undefined) => string,
): string =>
  variant.isMain ? "Main" : forkLabel(memberName(variant.ownerUserId));

// A deliberately conspicuous control: an accent-tinted, bordered pill so the
// branch point reads as an obvious "this reply has other versions" affordance
// rather than a stray row of avatars.
const rootStyles = css({
  alignItems: "center",
  alignSelf: "flex-start",
  backgroundColor:
    "color-mix(in oklab, {colors.accent} 8%, {colors.background})",
  border: "1px solid color-mix(in oklab, {colors.accent} 30%, {colors.border})",
  borderRadius: "full",
  color: "muted",
  display: "flex",
  gap: 1,
  paddingBlock: 1,
  paddingInline: 2,
});

const leadStyles = css({
  alignItems: "center",
  color: "accent",
  display: "inline-flex",
  fontSize: "xs",
  fontWeight: "semibold",
  gap: 1,
  marginInlineEnd: 1,
});

const facepileStyles = css({
  alignItems: "center",
  display: "flex",
  marginInlineEnd: 1,
});

const avatarSlotStyles = css({
  "&:first-child": { marginInlineStart: 0 },
  // Hovering a non-active avatar previews its selectability by lifting it and
  // clearing the dimming.
  "&:hover:not([data-active])": {
    opacity: 0.8,
    zIndex: 1,
  },
  "&[data-active]": {
    // Lift the active avatar above its neighbours so the overlap never dims
    // or clips it, and keep it fully opaque.
    opacity: 1,
    outlineColor: "accent",
    zIndex: 2,
  },
  backgroundColor: "transparent",
  borderRadius: "full",
  borderStyle: "none",
  cursor: "pointer",
  display: "inline-flex",
  marginInlineStart: -1.5,
  opacity: 0.5,
  outlineColor: "background",
  outlineStyle: "solid",
  outlineWidth: 2,
  padding: 0,
  position: "relative",
  transition: "opacity {durations.fast} {easings.out}",
});

const labelStyles = css({
  alignItems: "center",
  display: "flex",
  fontSize: "xs",
  fontWeight: "semibold",
  gap: 1.5,
});

const positionStyles = css({
  color: "muted",
  fontWeight: "normal",
});
