"use client";

import { Avatar } from "@forkroom/component-library/Avatar";
import { RobotIcon } from "@phosphor-icons/react/dist/ssr/Robot";
import { css } from "../../styled-system/css";
import { center } from "../../styled-system/patterns";
import type { ChatTreeNode } from "../client/chat-tree";
import { buildChatTree, chatHasForks } from "../client/chat-tree";
import type {
  BranchEntity,
  MemberEntity,
  MessageEntity,
} from "../contracts/chat-entities";

type Props = {
  messages: MessageEntity[];
  branches: BranchEntity[];
  members: Record<string, MemberEntity>;
  /** Message ids on the currently-displayed thread, lightly traced in the tree. */
  activeMessageIds: string[];
  /** The message in focus (e.g. scrolled into view), highlighted strongly. */
  currentMessageId: string | undefined;
  onSelectBranch: (branchId: string) => void;
};

// Drawing geometry, in SVG user units.
const CELL = 34;
const COL_PITCH = 40;
const ROW_PITCH = 52;
const PAD = 16;

const cellX = (column: number): number => PAD + column * COL_PITCH;
const cellY = (depth: number): number => PAD + depth * ROW_PITCH;
const centerX = (column: number): number => cellX(column) + CELL / 2;
const centerY = (depth: number): number => cellY(depth) + CELL / 2;

/**
 * A right-hand overview of the whole conversation as a tree: every message is a
 * node — assistant replies included — chained top to bottom, and a message that
 * was forked spreads its continuations across horizontal sibling columns. Nodes
 * are the authors' avatars; clicking one jumps to that branch's thread. The
 * message currently in focus is highlighted, and the active thread is traced,
 * so the tree tracks where you are as you scroll. Hidden until the chat forks.
 */
export const ChatTreePanel = ({
  messages,
  branches,
  members,
  activeMessageIds,
  currentMessageId,
  onSelectBranch,
}: Props) => {
  if (chatHasForks(branches)) {
    const tree = buildChatTree(messages, branches);
    const width = PAD * 2 + tree.maxColumn * COL_PITCH + CELL;
    const height = PAD * 2 + tree.maxDepth * ROW_PITCH + CELL;
    const activeIds = new Set(activeMessageIds);
    const centerById = new Map(
      tree.nodes.map((node) => [
        node.messageId,
        { x: centerX(node.column), y: centerY(node.depth) },
      ]),
    );
    const anchorOf = (messageId: string): { x: number; y: number } => {
      const anchor = centerById.get(messageId);
      if (anchor === undefined) {
        throw new Error(`Message ${messageId} is absent from the tree`);
      } else {
        return anchor;
      }
    };
    return (
      <aside aria-label="Conversation tree" className={asideStyles}>
        <div className={headerStyles}>Chat flow</div>
        <div className={scrollStyles}>
          <svg height={height} role="presentation" width={width}>
            <g>
              {tree.edges.map((edge) => (
                <path
                  className={edgeStyles}
                  d={edgePath(
                    anchorOf(edge.fromMessageId),
                    anchorOf(edge.toMessageId),
                  )}
                  key={`${edge.fromMessageId}-${edge.toMessageId}`}
                />
              ))}
            </g>
            {tree.nodes.map((node) => (
              <foreignObject
                height={CELL}
                key={node.messageId}
                width={CELL}
                x={cellX(node.column)}
                y={cellY(node.depth)}
              >
                <div className={cellStyles}>
                  <button
                    aria-current={
                      node.messageId === currentMessageId ? "true" : undefined
                    }
                    aria-label={authorLabel(node, members)}
                    className={nodeStyles}
                    data-current={
                      node.messageId === currentMessageId ? "" : undefined
                    }
                    data-onpath={activeIds.has(node.messageId) ? "" : undefined}
                    onClick={() => {
                      onSelectBranch(node.branchId);
                    }}
                    type="button"
                  >
                    <NodeAvatar members={members} node={node} />
                  </button>
                </div>
              </foreignObject>
            ))}
          </svg>
        </div>
      </aside>
    );
  } else {
    // React requires an explicit null for "render nothing".
    return null;
  }
};

const NodeAvatar = ({
  node,
  members,
}: {
  node: ChatTreeNode;
  members: Record<string, MemberEntity>;
}) => {
  if (node.role === "assistant") {
    return (
      <Avatar icon={<RobotIcon weight="fill" />} name="Assistant" size="2xs" />
    );
  } else {
    const member =
      node.authorUserId === undefined ? undefined : members[node.authorUserId];
    return (
      <Avatar
        name={member?.displayName ?? "A member"}
        size="2xs"
        src={member?.avatarUrl}
      />
    );
  }
};

const authorLabel = (
  node: ChatTreeNode,
  members: Record<string, MemberEntity>,
): string => {
  if (node.role === "assistant") {
    return "Assistant";
  } else {
    const member =
      node.authorUserId === undefined ? undefined : members[node.authorUserId];
    return member?.displayName ?? "A member";
  }
};

// A parent-to-child connector: a smooth S-curve dropping into the child.
const edgePath = (
  from: { x: number; y: number },
  to: { x: number; y: number },
): string => {
  const midY = (from.y + to.y) / 2;
  return `M ${from.x.toString()} ${from.y.toString()} C ${from.x.toString()} ${midY.toString()}, ${to.x.toString()} ${midY.toString()}, ${to.x.toString()} ${to.y.toString()}`;
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
  padding: 1,
});

const edgeStyles = css({ fill: "none", stroke: "border" });

const cellStyles = center({ blockSize: "100%", inlineSize: "100%" });

const nodeStyles = css({
  "&:focus-visible": {
    boxShadow: "0 0 0 {spacing.0.5} {colors.accent}",
    outlineStyle: "none",
  },
  "&:hover": { boxShadow: "0 0 0 {spacing.0.5} {colors.accent}" },
  "&[data-current]": { boxShadow: "0 0 0 {spacing.0.5} {colors.accent}" },
  "&[data-onpath]:not([data-current])": {
    boxShadow: "0 0 0 {spacing.0.5} {colors.borderStrong}",
  },
  background: "none",
  borderRadius: "full",
  borderStyle: "none",
  cursor: "pointer",
  display: "inline-flex",
  padding: 0,
});
