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
  onForkFromHere?: (() => void) | undefined;
};

/**
 * A single message in the linear thread. Authorship, role, and generation
 * status are conveyed with text and icons — never color alone (PRD §6.5). A
 * completed assistant reply offers a "fork from here" action when one is
 * provided; a fork always branches off a model turn, never a human message,
 * so the action is withheld on user and system messages.
 */
export const MessageView = ({ message, authorName, onForkFromHere }: Props) => {
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

const tagStyles = css({ color: "muted", fontSize: "xs" });
const failedTagStyles = css({ color: "danger", fontWeight: "semibold" });

const placeholderStyles = css({
  color: "muted",
  fontSize: "sm",
  fontStyle: "italic",
});
