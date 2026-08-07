"use client";

import { Avatar } from "@forkroom/component-library/Avatar";
import type { CSSProperties, ReactNode } from "react";
import { css } from "../../styled-system/css";

export type StackPeek = {
  branchId: string;
  ownerUserId: string;
  label: string;
};

type Props = {
  /** The selected conversation's real content — the top of the stack. */
  children: ReactNode;
  /** The other continuations, peeking out from underneath. */
  peeks: StackPeek[];
  ownerName: (userId: string) => string;
  onSelectBranch: (branchId: string) => void;
};

/**
 * The diverged conversation drawn as a physical stack: the selected thread's
 * real messages sit on top as a card, and the other continuations peek out from
 * underneath it — tucked down and to the side, dimmed — so you can see the whole
 * pile of alternatives right in the flow. Clicking a peeking card brings that
 * conversation to the top, switching the displayed thread.
 */
export const ThreadStack = ({
  children,
  peeks,
  ownerName,
  onSelectBranch,
}: Props) => (
  <div
    className={stackStyles}
    style={{ "--peek-count": peeks.length } as CSSProperties}
  >
    {/* Deepest first so nearer cards paint over farther ones; the top card,
        rendered last, paints over them all. */}
    {peeks
      .map((peek, index) => ({ peek, rank: index + 1 }))
      .reverse()
      .map(({ peek, rank }) => (
        <button
          aria-label={`Switch to ${peek.label}`}
          className={peekStyles}
          key={peek.branchId}
          onClick={() => {
            onSelectBranch(peek.branchId);
          }}
          style={{ "--rank": rank } as CSSProperties}
          title={peek.label}
          type="button"
        >
          <span className={peekTabStyles}>
            <Avatar name={ownerName(peek.ownerUserId)} size="2xs" />
            <span className={peekLabelStyles}>{peek.label}</span>
          </span>
        </button>
      ))}
    <div className={topStyles}>{children}</div>
  </div>
);

const stackStyles = css({
  display: "grid",
  // Reserve room to the end and below so the peeking edges aren't clipped.
  paddingBlockEnd: "calc(var(--peek-count) * {spacing.3})",
  paddingInlineEnd: "calc(var(--peek-count) * {spacing.3})",
});

const topStyles = css({
  backgroundColor: "background",
  border: "1px solid {colors.accent}",
  borderRadius: "xl",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  gridArea: "1 / 1",
  padding: 2,
  position: "relative",
});

// Each peeking card is the same size as the top card, shifted down and to the
// end and dimmed, so its far edges show from under the top card as a stack.
const peekStyles = css({
  _hover: { opacity: 1 },
  backgroundColor: "card",
  border: "1px solid {colors.border}",
  borderRadius: "xl",
  cursor: "pointer",
  gridArea: "1 / 1",
  opacity: "calc(1 - var(--rank) * 0.1)",
  overflow: "hidden",
  position: "relative",
  transform:
    "translate(calc(var(--rank) * {spacing.3}), calc(var(--rank) * {spacing.3}))",
  transition: "opacity {durations.fast} {easings.out}",
});

// A label tucked at the peeking bottom-end corner so each layer is identifiable.
const peekTabStyles = css({
  alignItems: "center",
  color: "muted",
  display: "flex",
  fontSize: "xs",
  fontWeight: "semibold",
  gap: 1,
  insetBlockEnd: 1,
  insetInlineEnd: 2,
  position: "absolute",
});

const peekLabelStyles = css({ whiteSpace: "nowrap" });
