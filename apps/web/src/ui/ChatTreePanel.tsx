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
  onSelectMessage: (branchId: string, messageId: string) => void;
};

// Drawing geometry, in SVG user units. Cells leave room around each avatar so
// the focused node can grow and glow without clipping or colliding.
const CELL = 48;
const COL_PITCH = 52;
const ROW_PITCH = 64;
const PAD = 20;
const PREVIEW_LIMIT = 200;

const cellX = (column: number): number => PAD + column * COL_PITCH;
const cellY = (depth: number): number => PAD + depth * ROW_PITCH;
const centerX = (column: number): number => cellX(column) + CELL / 2;
const centerY = (depth: number): number => cellY(depth) + CELL / 2;

/**
 * A right-hand overview of the whole conversation as a tree: every message is a
 * node — assistant replies included — chained top to bottom, and a message that
 * was forked spreads its continuations across horizontal sibling columns. Nodes
 * are the authors' avatars; hovering one previews the message, clicking one
 * jumps to it. The message in focus is highlighted and the active thread traced,
 * so the tree tracks where you are as you scroll. Hidden until the chat forks.
 */
export const ChatTreePanel = ({
  messages,
  branches,
  members,
  activeMessageIds,
  currentMessageId,
  onSelectMessage,
}: Props) => {
  if (chatHasForks(branches)) {
    const tree = buildChatTree(messages, branches);
    const messageById = new Map(
      messages.map((message) => [message.id, message]),
    );
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
                      onSelectMessage(node.branchId, node.messageId);
                    }}
                    title={previewOf(messageById.get(node.messageId))}
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
      <Avatar icon={<RobotIcon weight="fill" />} name="Assistant" size="xs" />
    );
  } else {
    const member =
      node.authorUserId === undefined ? undefined : members[node.authorUserId];
    return (
      <Avatar
        name={member?.displayName ?? "A member"}
        size="xs"
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

// The hover preview of a node's message — its text, trimmed, or a status stand-in
// while it has none yet.
const previewOf = (message: MessageEntity | undefined): string => {
  if (message === undefined) {
    return "";
  } else {
    const text = message.content.trim();
    if (text.length === 0) {
      return message.status === "failed"
        ? "Failed to generate."
        : "Generating…";
    } else if (text.length > PREVIEW_LIMIT) {
      return `${text.slice(0, PREVIEW_LIMIT)}…`;
    } else {
      return text;
    }
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
    boxShadow: "0 0 0 {spacing.1} {colors.accent}",
    outlineStyle: "none",
  },
  "&:hover:not([data-current])": {
    boxShadow: "0 0 0 {spacing.0.5} {colors.accent}",
    transform: "scale(1.1)",
  },
  // The focused node is unmistakable: it grows, gains a thick accent ring, and
  // throws an accent glow. On-path nodes wear a quiet ring; off-path, none.
  "&[data-current]": {
    boxShadow:
      "0 0 0 {spacing.1} {colors.accent}, 0 0 {spacing.3} {spacing.0.5} color-mix(in oklab, {colors.accent} 60%, transparent)",
    transform: "scale(1.22)",
  },
  "&[data-onpath]:not([data-current])": {
    boxShadow: "0 0 0 {spacing.0.5} {colors.borderStrong}",
  },
  background: "none",
  borderRadius: "full",
  borderStyle: "none",
  cursor: "pointer",
  display: "inline-flex",
  padding: 0,
  transition:
    "transform {durations.fast} {easings.out}, box-shadow {durations.fast} {easings.out}",
});
