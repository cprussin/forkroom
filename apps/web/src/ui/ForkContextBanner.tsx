"use client";

import { Button } from "@forkroom/component-library/Button";
import { GitForkIcon } from "@phosphor-icons/react/dist/ssr/GitFork";
import { css } from "../../styled-system/css";
import { viewingForkLabel } from "./fork-context-label";

type Props = {
  /** The fork owner's real display name — never "You". */
  ownerName: string;
  onReturnToMain: () => void;
};

/**
 * Accent-tinted banner that stays visible while the displayed thread follows a
 * non-main branch, making it unmistakable that the reader is on a fork and
 * offering a one-click return to the trunk.
 */
export const ForkContextBanner = ({ ownerName, onReturnToMain }: Props) => (
  <div className={bannerStyles} role="status">
    <span aria-hidden="true" className={iconStyles}>
      <GitForkIcon />
    </span>
    <span className={labelStyles}>{viewingForkLabel(ownerName)}</span>
    <Button onClick={onReturnToMain} size="xs" variant="ghost">
      Back to main
    </Button>
  </div>
);

const bannerStyles = css({
  alignItems: "center",
  backgroundColor:
    "color-mix(in oklab, {colors.accent} 14%, {colors.background})",
  borderBlockEnd:
    "1px solid color-mix(in oklab, {colors.accent} 45%, {colors.background})",
  color: "foreground",
  display: "flex",
  fontSize: "sm",
  gap: 2,
  justifyContent: "center",
  paddingBlock: 1.5,
  paddingInline: 4,
});

const iconStyles = css({
  alignItems: "center",
  color: "accent",
  display: "inline-flex",
});

const labelStyles = css({
  fontWeight: "semibold",
});
