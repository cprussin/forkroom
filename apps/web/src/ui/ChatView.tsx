"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import { buildThreadView } from "../client/thread-view";
import { useChatStream } from "../client/use-chat-stream";
import type { MessageEntity } from "../contracts/chat-entities";
import type { ChatSnapshot } from "../contracts/chat-snapshot";
import type { ForkPoint } from "./Composer";
import { Composer } from "./Composer";
import { ForkSwitcher } from "./ForkSwitcher";
import { MessageView } from "./MessageView";
import { ReconnectingBanner } from "./ReconnectingBanner";
import { TopBar } from "./TopBar";

/**
 * The live chat, rendered as a single linear thread like a typical AI chat app.
 * Holds the selected leaf branch (which thread is shown) and any pending
 * fork-from-history point, renders each message with a fork switcher where the
 * chat was branched, and stays current through the realtime stream.
 */
export const ChatView = ({ snapshot }: { snapshot: ChatSnapshot }) => {
  const { state, connected } = useChatStream(snapshot);
  const [leafBranchId, setLeafBranchId] = useState(snapshot.chat.mainBranchId);
  const [forkPoint, setForkPoint] = useState<ForkPoint | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  const leaf =
    state.branches[leafBranchId] ?? state.branches[snapshot.chat.mainBranchId];
  const entries = buildThreadView(
    state,
    leaf?.id ?? snapshot.chat.mainBranchId,
  );
  const members = Object.values(state.members);

  const memberName = (userId: string | undefined): string => {
    if (userId === undefined) {
      return "Unknown";
    } else if (userId === snapshot.currentUserId) {
      return "You";
    } else {
      return state.members[userId]?.displayName ?? "A member";
    }
  };

  // The owner's own display name (never "You"), so fork avatars show a real
  // person's initials rather than a first-person or role placeholder.
  const ownerName = (userId: string): string =>
    state.members[userId]?.displayName ?? "A member";

  const selectBranch = (branchId: string) => {
    setForkPoint(undefined);
    setLeafBranchId(branchId);
  };

  const forkFromHere = (message: MessageEntity) => {
    setForkPoint({
      label: forkPointLabel(message, memberName),
      messageId: message.id,
    });
  };

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    const node = scrollRef.current;
    if (node !== null && entries.length > 0) {
      node.scrollTo({ behavior: "smooth", top: node.scrollHeight });
    }
  }, [entries.length]);

  return (
    <div className={pageStyles}>
      <TopBar
        chatId={snapshot.chat.id}
        isCreator={snapshot.currentUserRole === "creator"}
        members={members}
        title={snapshot.chat.title}
      />
      {connected ? undefined : <ReconnectingBanner />}
      <div
        aria-label="Conversation"
        className={scrollStyles}
        ref={scrollRef}
        role="log"
      >
        <div className={threadStyles}>
          {entries.length === 0 ? (
            <p className={emptyStyles}>No messages yet. Say hello.</p>
          ) : (
            entries.map((entry) => (
              <div className={entryStyles} key={entry.message.id}>
                <MessageView
                  authorName={memberName(entry.message.authorUserId)}
                  forkCount={
                    entry.fork === undefined
                      ? undefined
                      : entry.fork.variants.length
                  }
                  message={entry.message}
                  onForkFromHere={() => {
                    forkFromHere(entry.message);
                  }}
                />
                {entry.fork === undefined ? undefined : (
                  <ForkSwitcher
                    fork={entry.fork}
                    memberName={memberName}
                    onSelectBranch={selectBranch}
                    ownerName={ownerName}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
      {leaf === undefined ? undefined : (
        <Composer
          chatId={snapshot.chat.id}
          connected={connected}
          currentUserId={snapshot.currentUserId}
          forkPoint={forkPoint}
          leafBranch={leaf}
          memberName={memberName}
          onClearForkPoint={() => {
            setForkPoint(undefined);
          }}
          onSelectBranch={selectBranch}
          state={state}
        />
      )}
    </div>
  );
};

const forkPointLabel = (
  message: MessageEntity,
  memberName: (userId: string | undefined) => string,
): string =>
  message.role === "assistant"
    ? "the assistant's reply"
    : `${memberName(message.authorUserId)} message`;

const pageStyles = css({
  blockSize: "100%",
  display: "flex",
  flex: 1,
  flexDirection: "column",
  minBlockSize: 0,
});

const scrollStyles = css({
  display: "flex",
  flex: 1,
  justifyContent: "center",
  minBlockSize: 0,
  overflowY: "auto",
});

const threadStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  inlineSize: "100%",
  maxInlineSize: "3xl",
  paddingBlock: 4,
  paddingInline: 4,
});

const entryStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: 1,
});

const emptyStyles = css({
  color: "muted",
  fontSize: "sm",
  paddingBlock: 8,
  textAlign: "center",
});
