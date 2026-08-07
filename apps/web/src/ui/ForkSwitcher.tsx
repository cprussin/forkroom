"use client";

import { Button } from "@forkroom/component-library/Button";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { css } from "../../styled-system/css";
import type { ForkSwitch, ForkVariant } from "../client/thread-view";
import { forkLabel } from "./fork-label";

type Props = {
  fork: ForkSwitch;
  memberName: (userId: string | undefined) => string;
  onSelectBranch: (branchId: string) => void;
};

/**
 * ChatGPT-style variant navigation for a forked message: step through the
 * branches that continue from this point — the trunk plus every collaborator's
 * fork — switching the displayed thread to the chosen one.
 */
export const ForkSwitcher = ({ fork, memberName, onSelectBranch }: Props) => {
  const activeIndex = fork.variants.findIndex(
    (variant) => variant.branchId === fork.activeBranchId,
  );
  const active = fork.variants[activeIndex];
  const previous = fork.variants[activeIndex - 1];
  const next = fork.variants[activeIndex + 1];

  return (
    <div aria-label="Switch forks" className={rootStyles} role="group">
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

const rootStyles = css({
  alignItems: "center",
  alignSelf: "flex-start",
  color: "muted",
  display: "flex",
  gap: 1,
  paddingInline: 1,
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
