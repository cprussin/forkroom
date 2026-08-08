"use client";

import { Avatar } from "@forkroom/component-library/Avatar";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { css, cx } from "../../styled-system/css";

export type CarouselFork = {
  branchId: string;
  ownerUserId: string;
  label: string;
  /** The rendered continuation of this conversation past the fork. */
  content: ReactNode;
};

type Props = {
  forks: CarouselFork[];
  activeBranchId: string;
  ownerName: (userId: string) => string;
  onSelectBranch: (branchId: string) => void;
};

/**
 * A fork point laid out as a horizontal row of conversations: the selected one
 * is centred as the main column and the other continuations sit to either side,
 * peeking in from the edges. Clicking a side conversation's header slides it to
 * the middle (switching the displayed thread). The active column is scrolled
 * back to centre whenever the selection changes.
 */
export const ForkCarousel = ({
  forks,
  activeBranchId,
  ownerName,
  onSelectBranch,
}: Props) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const track = trackRef.current;
    const element = activeRef.current;
    // Re-centre the active column by scrolling the track itself, never
    // scrollIntoView: that walks every scrollable ancestor and would drag the
    // page down just to bring the column's top edge into view. Here we only
    // ever touch the track's horizontal offset.
    if (
      track === null ||
      element === null ||
      typeof track.scrollTo !== "function"
    ) {
      return;
    }
    const trackRect = track.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const offset =
      elementRect.left -
      trackRect.left -
      (track.clientWidth - element.clientWidth) / 2;
    track.scrollTo({ behavior: "smooth", left: track.scrollLeft + offset });
  }, [activeBranchId]);
  return (
    <div
      aria-label="Fork conversations"
      className={trackStyles}
      ref={trackRef}
      role="group"
    >
      {forks.map((fork) => {
        const isActive = fork.branchId === activeBranchId;
        return (
          <div
            className={cx(
              columnStyles,
              isActive ? undefined : sideColumnStyles,
            )}
            data-active={isActive ? "" : undefined}
            key={fork.branchId}
            ref={isActive ? activeRef : undefined}
          >
            <button
              aria-current={isActive ? "true" : undefined}
              className={headerStyles}
              onClick={() => {
                onSelectBranch(fork.branchId);
              }}
              type="button"
            >
              <Avatar name={ownerName(fork.ownerUserId)} size="2xs" />
              <span className={labelStyles}>{fork.label}</span>
            </button>
            <div className={bodyStyles}>{fork.content}</div>
          </div>
        );
      })}
    </div>
  );
};

// Columns are wide enough to read but leave room for neighbours to peek in; the
// literal is inlined at each site so Panda extracts it reliably.
const trackStyles = css({
  "&::-webkit-scrollbar": { display: "none" },
  display: "flex",
  gap: 4,
  overflowX: "auto",
  // Enough lead/tail room that the first and last columns can reach the centre.
  paddingInline: "calc((100% - min(86%, {sizes.2xl})) / 2)",
  scrollBehavior: "smooth",
  scrollbarWidth: "none",
  scrollSnapType: "x mandatory",
});

const columnStyles = css({
  display: "flex",
  flexBasis: "min(86%, {sizes.2xl})",
  flexDirection: "column",
  flexGrow: 0,
  flexShrink: 0,
  gap: 2,
  scrollSnapAlign: "center",
});

// Side conversations are dimmed and settled back, so the centred one reads as
// the main thread; hovering one lifts it to hint it is selectable.
const sideColumnStyles = css({
  _hover: { opacity: 1 },
  opacity: 0.55,
  transform: "scale(0.97)",
  transformOrigin: "center top",
  transition:
    "opacity {durations.normal} {easings.out}, transform {durations.normal} {easings.out}",
});

const headerStyles = css({
  _hover: { backgroundColor: "card" },
  "&[aria-current]": { borderColor: "accent", color: "accent" },
  alignItems: "center",
  alignSelf: "flex-start",
  backgroundColor: "background",
  border: "1px solid {colors.border}",
  borderRadius: "full",
  color: "muted",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: "xs",
  fontWeight: "semibold",
  gap: 1.5,
  insetBlockStart: 2,
  paddingBlock: 1,
  paddingInline: 2,
  position: "sticky",
  zIndex: 1,
});

const labelStyles = css({ whiteSpace: "nowrap" });

const bodyStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: 2,
});
