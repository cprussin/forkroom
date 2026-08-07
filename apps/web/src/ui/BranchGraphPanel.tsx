"use client";

import type { KeyboardEvent } from "react";
import { css } from "../../styled-system/css";
import type { BranchGraphNode } from "../client/branch-graph";
import { branchGraphHasForks, layoutBranchGraph } from "../client/branch-graph";
import type { BranchEntity } from "../contracts/chat-entities";
import { forkLabel } from "./fork-label";

type Props = {
  branches: BranchEntity[];
  /** The branch whose thread is currently shown; highlighted in the graph. */
  currentBranchId: string;
  /** The owner's display name (never "You"), for the branch labels. */
  ownerName: (userId: string) => string;
  onSelectBranch: (branchId: string) => void;
};

// Drawing geometry, in SVG user units.
const LANE_WIDTH = 22;
const ROW_HEIGHT = 40;
const PAD_X = 14;
const PAD_Y = 20;
const DOT_RADIUS = 5;
const LABEL_GAP = 12;
const LABEL_WIDTH = 150;
const CORNER = 8;

const laneX = (lane: number): number => PAD_X + lane * LANE_WIDTH;
const rowY = (row: number): number => PAD_Y + row * ROW_HEIGHT;

/**
 * A right-hand overview of the whole conversation's shape: a git-style graph
 * with the trunk in the leftmost lane and every fork branching out into the
 * horizontal space below the message it forked from, nested forks further out
 * again. Each node jumps to that branch's thread, and the branch being viewed
 * is highlighted — so the fork structure is legible at a glance from anywhere
 * in the chat. Renders nothing until the chat actually has a fork.
 */
export const BranchGraphPanel = ({
  branches,
  currentBranchId,
  ownerName,
  onSelectBranch,
}: Props) => {
  const graph = layoutBranchGraph(branches);
  if (branchGraphHasForks(graph)) {
    const labelX = laneX(graph.laneCount) + LABEL_GAP;
    const width = labelX + LABEL_WIDTH;
    const height = rowY(graph.nodes.length - 1) + PAD_Y;
    const nodeById = new Map(graph.nodes.map((node) => [node.branchId, node]));
    const centerOf = (branchId: string): { x: number; y: number } => {
      const node = nodeById.get(branchId);
      if (node === undefined) {
        throw new Error(`Branch ${branchId} is absent from the graph`);
      } else {
        return { x: laneX(node.lane), y: rowY(node.row) };
      }
    };
    const labelOf = (node: BranchGraphNode): string =>
      node.isMain ? "Main" : forkLabel(ownerName(node.ownerUserId));
    return (
      <aside aria-label="Branch map" className={asideStyles}>
        <div className={headerStyles}>Chat flow</div>
        <div className={scrollStyles}>
          <svg height={height} role="presentation" width={width}>
            <g>
              {graph.edges.map((edge) => (
                <path
                  className={edgeStyles}
                  d={edgePath(
                    centerOf(edge.fromBranchId),
                    centerOf(edge.toBranchId),
                  )}
                  key={`${edge.fromBranchId}-${edge.toBranchId}`}
                />
              ))}
            </g>
            {graph.nodes.map((node) => {
              const center = { x: laneX(node.lane), y: rowY(node.row) };
              const isCurrent = node.branchId === currentBranchId;
              const select = () => {
                onSelectBranch(node.branchId);
              };
              return (
                <g
                  aria-current={isCurrent ? "true" : undefined}
                  aria-label={labelOf(node)}
                  className={nodeStyles}
                  data-current={isCurrent ? "" : undefined}
                  key={node.branchId}
                  onClick={select}
                  onKeyDown={(event) => {
                    activateOnEnterOrSpace(event, select);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <rect
                    className={hitStyles}
                    height={ROW_HEIGHT}
                    width={width}
                    x={0}
                    y={center.y - ROW_HEIGHT / 2}
                  />
                  <circle
                    className={dotStyles}
                    cx={center.x}
                    cy={center.y}
                    data-dot=""
                    r={DOT_RADIUS}
                    strokeWidth={1.5}
                  />
                  <text
                    className={labelStyles}
                    data-label=""
                    dominantBaseline="central"
                    x={labelX}
                    y={center.y}
                  >
                    {labelOf(node)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </aside>
    );
  } else {
    // React requires an explicit null for "render nothing".
    return null;
  }
};

const activateOnEnterOrSpace = (
  event: KeyboardEvent<SVGGElement>,
  activate: () => void,
): void => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activate();
  }
};

// A parent-to-fork connector: straight down the parent's lane, a rounded
// corner, then right into the fork's node.
const edgePath = (
  from: { x: number; y: number },
  to: { x: number; y: number },
): string => {
  const corner = Math.min(CORNER, (to.y - from.y) / 2, (to.x - from.x) / 2);
  return `M ${from.x.toString()} ${from.y.toString()} V ${(to.y - corner).toString()} Q ${from.x.toString()} ${to.y.toString()} ${(from.x + corner).toString()} ${to.y.toString()} H ${to.x.toString()}`;
};

const asideStyles = css({
  backgroundColor: "card",
  borderInlineStart: "1px solid {colors.border}",
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  inlineSize: 64,
  minBlockSize: 0,
});

const headerStyles = css({
  borderBlockEnd: "1px solid {colors.border}",
  color: "muted",
  fontSize: "xs",
  fontWeight: "semibold",
  paddingBlock: 2,
  paddingInline: 3,
});

const scrollStyles = css({
  flex: 1,
  minBlockSize: 0,
  overflow: "auto",
  paddingBlock: 1,
});

const edgeStyles = css({ fill: "none", stroke: "border" });

const hitStyles = css({ fill: "transparent" });

const dotStyles = css({ fill: "card", stroke: "borderStrong" });

const labelStyles = css({ fill: "muted", fontSize: "sm" });

const nodeStyles = css({
  "&:focus-visible [data-dot]": { stroke: "accent" },
  "&:hover [data-dot]": { fill: "accent", stroke: "accent" },
  "&:hover [data-label]": { fill: "accent" },
  "&[data-current] [data-dot]": { fill: "accent", stroke: "accent" },
  "&[data-current] [data-label]": {
    fill: "foreground",
    fontWeight: "semibold",
  },
  cursor: "pointer",
  outlineStyle: "none",
});
