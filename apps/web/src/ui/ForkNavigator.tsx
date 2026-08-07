"use client";

import { Avatar } from "@forkroom/component-library/Avatar";
import { Popover } from "@forkroom/component-library/Popover";
import { GitForkIcon } from "@phosphor-icons/react/dist/ssr/GitFork";
import { css } from "../../styled-system/css";
import { hstack, vstack } from "../../styled-system/patterns";
import type { BranchTreeNode } from "../client/branch-tree";
import { forkNodes } from "../client/branch-tree";
import { forkLabel } from "./fork-label";

type Props = {
  /** The chat's branches in tree order (trunk first, forks nested). */
  nodes: BranchTreeNode[];
  /** The branch whose thread is currently shown, highlighted in the list. */
  currentBranchId: string;
  /** The owner's display name (never "You"), for avatars and fork labels. */
  ownerName: (userId: string) => string;
  onSelectBranch: (branchId: string) => void;
};

/**
 * A persistent, always-visible fork indicator for the chat header: a count of
 * how many forks the conversation has, revealing the full branch hierarchy —
 * the trunk plus every fork, nested forks indented under their parent — in a
 * hover popover. Each row jumps to that branch's thread. Unlike the inline
 * switcher, this surfaces that forks exist from anywhere in the chat, including
 * while reading the trunk.
 */
export const ForkNavigator = ({
  nodes,
  currentBranchId,
  ownerName,
  onSelectBranch,
}: Props) => {
  const forks = forkNodes(nodes);
  if (forks.length === 0) {
    // React requires an explicit null for "render nothing".
    return null;
  } else {
    return (
      <Popover
        openOnHover
        trigger={
          <button className={triggerStyles} type="button">
            <GitForkIcon weight="bold" />
            <span className={countStyles}>
              {forks.length.toString()} {forks.length === 1 ? "fork" : "forks"}
            </span>
          </button>
        }
      >
        <ul className={listStyles}>
          {nodes.map((node) => (
            <li key={node.branchId}>
              <button
                aria-current={
                  node.branchId === currentBranchId ? "true" : undefined
                }
                className={rowStyles}
                data-current={
                  node.branchId === currentBranchId ? "" : undefined
                }
                onClick={() => {
                  onSelectBranch(node.branchId);
                }}
                type="button"
              >
                <span aria-hidden className={indentStyles(indentStep(node))} />
                <Avatar name={ownerName(node.ownerUserId)} size="2xs" />
                <span className={nameStyles}>
                  {node.isMain
                    ? "Main"
                    : forkLabel(ownerName(node.ownerUserId))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Popover>
    );
  }
};

// Indentation is capped so a deep fork-of-a-fork chain never pushes labels off
// the popover; past the cap every level shares the deepest indent.
const MAX_INDENT = 4;
const indentStep = (node: BranchTreeNode): number =>
  Math.min(node.depth, MAX_INDENT);

const triggerStyles = hstack({
  _hover: {
    backgroundColor:
      "color-mix(in oklab, {colors.accent} 12%, {colors.background})",
    color: "accent",
  },
  backgroundColor:
    "color-mix(in oklab, {colors.accent} 8%, {colors.background})",
  border: "1px solid color-mix(in oklab, {colors.accent} 30%, {colors.border})",
  borderRadius: "full",
  color: "accent",
  cursor: "pointer",
  gap: 1,
  paddingBlock: 1,
  paddingInline: 2,
});

const countStyles = css({
  fontSize: "sm",
  fontWeight: "semibold",
  whiteSpace: "nowrap",
});

const listStyles = vstack({
  alignItems: "stretch",
  gap: 0.5,
  listStyleType: "none",
  margin: 0,
  maxBlockSize: "20rem",
  minInlineSize: "14rem",
  overflowY: "auto",
  padding: 2,
});

const rowStyles = hstack({
  _hover: { backgroundColor: "background" },
  "&[data-current]": {
    backgroundColor: "background",
    fontWeight: "semibold",
  },
  background: "none",
  borderRadius: "md",
  borderStyle: "none",
  color: "foreground",
  cursor: "pointer",
  gap: 2,
  inlineSize: "100%",
  justifyContent: "flex-start",
  paddingBlock: 1.5,
  paddingInline: 2,
  textAlign: "start",
});

const nameStyles = css({
  fontSize: "sm",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

// One class per indent level so Panda extracts each width statically.
const indentStyles = (step: number): string => {
  switch (step) {
    case 0: {
      return indent0;
    }
    case 1: {
      return indent1;
    }
    case 2: {
      return indent2;
    }
    case 3: {
      return indent3;
    }
    default: {
      return indent4;
    }
  }
};

const indent0 = css({ display: "none" });
const indent1 = css({ flexShrink: 0, inlineSize: 3 });
const indent2 = css({ flexShrink: 0, inlineSize: 6 });
const indent3 = css({ flexShrink: 0, inlineSize: 9 });
const indent4 = css({ flexShrink: 0, inlineSize: 12 });
