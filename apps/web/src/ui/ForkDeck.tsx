"use client";

import { Avatar } from "@forkroom/component-library/Avatar";
import type { CSSProperties } from "react";
import { css, cx } from "../../styled-system/css";

export type DeckVariant = {
  branchId: string;
  ownerUserId: string;
  label: string;
  /** A one-line snippet of where this conversation goes past the fork. */
  preview: string;
};

type Props = {
  variants: DeckVariant[];
  activeBranchId: string;
  ownerName: (userId: string) => string;
  onSelectBranch: (branchId: string) => void;
};

/**
 * A fork point drawn as a stack of conversation cards, iOS "pile of photos"
 * style: the selected conversation sits on top of the pile as a full card, and
 * the other continuations peek out from underneath it, tucked back and dimmed.
 * Clicking a peeking card brings that conversation to the top (switches the
 * displayed thread), so the alternatives are always visible right at the fork.
 */
export const ForkDeck = ({
  variants,
  activeBranchId,
  ownerName,
  onSelectBranch,
}: Props) => {
  const active = variants.find(
    (variant) => variant.branchId === activeBranchId,
  );
  const others = variants.filter(
    (variant) => variant.branchId !== activeBranchId,
  );
  return (
    <div
      aria-label="Conversation versions"
      className={deckStyles}
      role="group"
      style={{ "--peek-count": others.length } as CSSProperties}
    >
      {/* Deepest first so nearer cards paint over farther ones, and the top
          card (rendered last) paints over them all. */}
      {others
        .map((variant, index) => ({ rank: index + 1, variant }))
        .reverse()
        .map(({ variant, rank }) => (
          <button
            className={cx(cardStyles, peekStyles)}
            key={variant.branchId}
            onClick={() => {
              onSelectBranch(variant.branchId);
            }}
            style={{ "--rank": rank } as CSSProperties}
            title={variant.label}
            type="button"
          >
            <Card ownerName={ownerName} variant={variant} />
          </button>
        ))}
      {active === undefined ? undefined : (
        <button
          aria-current="true"
          className={cx(cardStyles, topStyles)}
          onClick={() => {
            onSelectBranch(active.branchId);
          }}
          title={active.label}
          type="button"
        >
          <Card ownerName={ownerName} variant={active} />
        </button>
      )}
    </div>
  );
};

const Card = ({
  variant,
  ownerName,
}: {
  variant: DeckVariant;
  ownerName: (userId: string) => string;
}) => (
  <>
    <Avatar name={ownerName(variant.ownerUserId)} size="2xs" />
    <span className={textStyles}>
      <span className={labelStyles}>{variant.label}</span>
      <span className={previewStyles}>{variant.preview}</span>
    </span>
  </>
);

// The stack reserves room below the top card for the peeking edges.
const deckStyles = css({
  alignSelf: "stretch",
  maxInlineSize: "2xl",
  paddingBlockEnd: "calc(var(--peek-count) * {spacing.2.5})",
  position: "relative",
});

const cardStyles = css({
  alignItems: "center",
  backgroundColor: "card",
  blockSize: 16,
  borderRadius: "lg",
  cursor: "pointer",
  display: "flex",
  gap: 2,
  inlineSize: "100%",
  overflow: "hidden",
  paddingInline: 3,
  textAlign: "start",
});

const topStyles = css({
  border: "1px solid {colors.accent}",
  boxShadow: "lifted",
  position: "relative",
  zIndex: 1,
});

// Each peeking card is tucked further down and narrower, and dimmed, so the
// pile reads as depth beneath the selected conversation.
const peekStyles = css({
  _hover: { filter: "brightness(1.06)" },
  border: "1px solid {colors.border}",
  insetBlockStart: "calc(var(--rank) * {spacing.2.5})",
  insetInline: "calc(var(--rank) * {spacing.2})",
  opacity: "calc(1 - var(--rank) * 0.12)",
  position: "absolute",
  transition: "filter {durations.fast} {easings.out}",
});

const textStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: 0.5,
  minInlineSize: 0,
});

const labelStyles = css({
  color: "foreground",
  fontSize: "sm",
  fontWeight: "semibold",
});

const previewStyles = css({
  color: "muted",
  fontSize: "xs",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
