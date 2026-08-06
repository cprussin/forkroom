"use client";

import { Avatar } from "@forkroom/component-library/Avatar";
import { css, cx } from "../../styled-system/css";
import type { MessageEntity } from "../contracts/chat-entities";
import { Markdown } from "./Markdown";

type Props = {
  message: MessageEntity;
  authorName: string;
  subdued?: boolean;
};

/**
 * A single message. Authorship, role, and generation status are conveyed with
 * text and icons — never color alone (PRD §6.5). Inherited messages render
 * subdued.
 */
export const MessageView = ({
  message,
  authorName,
  subdued = false,
}: Props) => {
  const isAssistant = message.role === "assistant";
  return (
    <article
      className={cx(rootStyles, subdued ? subduedStyles : undefined)}
      data-role={message.role}
    >
      <header className={headerStyles}>
        <Avatar name={isAssistant ? "AI" : authorName} size="xs" />
        <span className={authorStyles}>
          {isAssistant ? "Assistant" : authorName}
        </span>
        <StatusTag status={message.status} />
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
  paddingBlock: 2,
  paddingInline: 2.5,
});

const subduedStyles = css({ opacity: 0.6 });

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

const tagStyles = css({ color: "muted", fontSize: "xs" });
const failedTagStyles = css({ color: "danger", fontWeight: "semibold" });

const placeholderStyles = css({
  color: "muted",
  fontSize: "sm",
  fontStyle: "italic",
});
