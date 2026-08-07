"use client";

import { Avatar } from "@forkroom/component-library/Avatar";
import { Button } from "@forkroom/component-library/Button";
import { GitForkIcon } from "@phosphor-icons/react/dist/ssr/GitFork";
import { RobotIcon } from "@phosphor-icons/react/dist/ssr/Robot";
import { css, cx } from "../../styled-system/css";
import type { MessageEntity } from "../contracts/chat-entities";
import { Markdown } from "./Markdown";

type Props = {
  message: MessageEntity;
  authorName: string;
  /** Number of continuations that branch from this message — the trunk plus
   * every fork. When defined it is at least 2, marking this message as the
   * point where the conversation splits. */
  forkCount?: number | undefined;
  onForkFromHere?: (() => void) | undefined;
};

/**
 * A single message in the linear thread. Authorship, role, and generation
 * status are conveyed with text and icons — never color alone (PRD §6.5). A
 * message the conversation branches at wears an accent spine and a "N versions"
 * badge so the split is obvious at a glance. A completed message offers a "fork
 * from here" action when one is provided.
 */
export const MessageView = ({
  message,
  authorName,
  forkCount,
  onForkFromHere,
}: Props) => {
  const isAssistant = message.role === "assistant";
  const isForkPoint = forkCount !== undefined;
  return (
    <article
      className={cx(rootStyles, isForkPoint ? forkedStyles : undefined)}
      data-forked={isForkPoint ? "" : undefined}
      data-role={message.role}
    >
      <header className={headerStyles}>
        <Avatar
          icon={isAssistant ? <RobotIcon weight="fill" /> : undefined}
          name={isAssistant ? "Assistant" : authorName}
          size="xs"
        />
        <span className={authorStyles}>
          {isAssistant ? "Assistant" : authorName}
        </span>
        <StatusTag status={message.status} />
        {isForkPoint ? (
          <span className={forkBadgeStyles}>
            <GitForkIcon weight="bold" />
            {`${forkCount.toString()} versions`}
          </span>
        ) : undefined}
        {onForkFromHere === undefined ||
        message.status !== "completed" ? undefined : (
          <span className={actionsStyles}>
            <Button
              beforeIcon={<GitForkIcon />}
              onClick={onForkFromHere}
              size="xs"
              variant="ghost"
            >
              Fork from here
            </Button>
          </span>
        )}
      </header>
      {message.content.length > 0 ? (
        <Markdown content={message.content} />
      ) : (
        <p className={placeholderStyles}>
          {message.status === "failed"
            ? "The response failed to generate."
            : "Generating…"}
        </p>
      )}
    </article>
  );
};

const StatusTag = ({ status }: { status: MessageEntity["status"] }) => {
  switch (status) {
    case "completed": {
      // React requires an explicit null for "render nothing".
      return null;
    }
    case "queued": {
      return <span className={tagStyles}>· queued</span>;
    }
    case "streaming": {
      return (
        <span className={tagStyles} data-live="">
          · generating…
        </span>
      );
    }
    case "failed": {
      return <span className={cx(tagStyles, failedTagStyles)}>· failed</span>;
    }
  }
};

const rootStyles = css({
  "&[data-role='assistant']": { backgroundColor: "card" },
  borderRadius: "md",
  display: "flex",
  flexDirection: "column",
  gap: 1.5,
  paddingBlock: 3,
  paddingInline: 3.5,
});

// The branch point. An accent spine on the leading edge (drawn as an inset
// shadow so it layers over any role background without a width literal) marks
// where the conversation splits; paired with the header badge's icon + text so
// the cue never rests on color alone (PRD §6.5).
const forkedStyles = css({
  boxShadow: "inset {spacing.1} 0 0 0 {colors.accent}",
});

const forkBadgeStyles = css({
  alignItems: "center",
  backgroundColor:
    "color-mix(in oklab, {colors.accent} 15%, {colors.background})",
  borderRadius: "full",
  color: "accent",
  display: "inline-flex",
  fontSize: "xs",
  fontWeight: "semibold",
  gap: 1,
  paddingBlock: 0.5,
  paddingInline: 1.5,
});

const headerStyles = css({
  alignItems: "center",
  display: "flex",
  gap: 1.5,
});

const authorStyles = css({
  color: "foreground",
  fontSize: "xs",
  fontWeight: "semibold",
});

const actionsStyles = css({
  marginInlineStart: "auto",
});

const tagStyles = css({ color: "muted", fontSize: "xs" });
const failedTagStyles = css({ color: "danger", fontWeight: "semibold" });

const placeholderStyles = css({
  color: "muted",
  fontSize: "sm",
  fontStyle: "italic",
});
