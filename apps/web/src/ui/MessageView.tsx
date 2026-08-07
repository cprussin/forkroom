"use client";

import { Avatar } from "@forkroom/component-library/Avatar";
import { Button } from "@forkroom/component-library/Button";
import { GitForkIcon } from "@phosphor-icons/react/dist/ssr/GitFork";
import { RobotIcon } from "@phosphor-icons/react/dist/ssr/Robot";
import { css, cx } from "../../styled-system/css";
import type { MessageEntity } from "../contracts/chat-entities";
import { Markdown } from "./Markdown";

/** A message's place in a fork: its branch's label and 1-based position among
 * the sibling variants, with a handler to switch to the next one. */
type ForkChip = {
  label: string;
  position: string;
  onSwitch: () => void;
};

type Props = {
  message: MessageEntity;
  authorName: string;
  /** When this message is on a fork, a chip marking it and switching variants. */
  forkChip?: ForkChip | undefined;
  onForkFromHere?: (() => void) | undefined;
};

/**
 * A single message in the linear thread. Authorship, role, and generation
 * status are conveyed with text and icons — never color alone (PRD §6.5). A
 * message on a fork wears a chip naming its branch (and switching variants),
 * so wherever you are in a branched reply it stays clear it's a fork. A
 * completed assistant reply offers a "fork from here" action when one is
 * provided; a fork always branches off a model turn, never a human message,
 * so the action is withheld on user and system messages.
 */
export const MessageView = ({
  message,
  authorName,
  forkChip,
  onForkFromHere,
}: Props) => {
  const isAssistant = message.role === "assistant";
  return (
    <article className={rootStyles} data-role={message.role}>
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
        {forkChip === undefined ? undefined : (
          <button
            className={chipStyles}
            onClick={forkChip.onSwitch}
            title="Switch to the next version"
            type="button"
          >
            <GitForkIcon weight="bold" />
            <span>{forkChip.label}</span>
            <span className={chipPositionStyles}>{forkChip.position}</span>
          </button>
        )}
        {onForkFromHere === undefined ||
        !isAssistant ||
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

const chipStyles = css({
  _hover: {
    backgroundColor:
      "color-mix(in oklab, {colors.accent} 25%, {colors.background})",
  },
  alignItems: "center",
  backgroundColor:
    "color-mix(in oklab, {colors.accent} 15%, {colors.background})",
  border: "1px solid color-mix(in oklab, {colors.accent} 30%, {colors.border})",
  borderRadius: "full",
  color: "accent",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: "xs",
  fontWeight: "semibold",
  gap: 1,
  paddingBlock: 0.5,
  paddingInline: 1.5,
});

const chipPositionStyles = css({ color: "muted", fontWeight: "normal" });

const tagStyles = css({ color: "muted", fontSize: "xs" });
const failedTagStyles = css({ color: "danger", fontWeight: "semibold" });

const placeholderStyles = css({
  color: "muted",
  fontSize: "sm",
  fontStyle: "italic",
});
