"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import { buildThreadView } from "../client/thread-view";
import { useChatStream } from "../client/use-chat-stream";
import type { MessageEntity } from "../contracts/chat-entities";
import type { ChatSnapshot } from "../contracts/chat-snapshot";
import { ChatTreePanel } from "./ChatTreePanel";
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
  const [focusedMessageId, setFocusedMessageId] = useState<string | undefined>(
    undefined,
  );
  const [pendingScrollId, setPendingScrollId] = useState<string | undefined>(
    undefined,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const previousLengthRef = useRef(0);
  const jumpPendingRef = useRef(false);

  const leaf =
    state.branches[leafBranchId] ?? state.branches[snapshot.chat.mainBranchId];
  const currentBranchId = leaf?.id ?? snapshot.chat.mainBranchId;
  const entries = buildThreadView(state, currentBranchId);
  const members = Object.values(state.members);
  const activeMessageIds = entries.map((entry) => entry.message.id);
  // Stable key of the visible path, so the scroll observer re-binds only when
  // the set of on-screen messages actually changes.
  const threadKey = activeMessageIds.join("|");
  // The tree highlights whatever message is scrolled into focus; before the
  // first scroll it falls back to the tip of the current thread.
  const focusedInTree = focusedMessageId ?? activeMessageIds.at(-1);

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

  // Picking a node in the tree switches to its branch and scrolls that exact
  // message into view — highlighting it at once for immediate feedback, and
  // suppressing the keep-newest-in-view scroll so it doesn't fight the jump.
  const jumpToMessage = (branchId: string, messageId: string) => {
    jumpPendingRef.current = true;
    setFocusedMessageId(messageId);
    selectBranch(branchId);
    setPendingScrollId(messageId);
  };

  // Only assistant replies expose a fork action (MessageView withholds it on
  // human messages), so a fork point is always the assistant's reply.
  const forkFromHere = (message: MessageEntity) => {
    setForkPoint({
      label: "the assistant's reply",
      messageId: message.id,
    });
  };

  // Keep the newest message in view as the thread grows — but not when a node
  // jump is steering the scroll somewhere specific.
  useEffect(() => {
    const node = scrollRef.current;
    const grew = entries.length > previousLengthRef.current;
    previousLengthRef.current = entries.length;
    if (node !== null && grew && !jumpPendingRef.current) {
      node.scrollTo({ behavior: "smooth", top: node.scrollHeight });
    }
  }, [entries.length]);

  // After a node jump re-renders the (possibly switched) thread, bring the
  // chosen message into view.
  useEffect(() => {
    if (pendingScrollId !== undefined) {
      const element = messageRefs.current.get(pendingScrollId);
      if (element !== undefined) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      jumpPendingRef.current = false;
      setPendingScrollId(undefined);
    }
  }, [pendingScrollId]);

  // Track which message is in focus as the thread scrolls, so the tree's
  // highlight follows the reader. The focus line slides from the top of the
  // viewport toward the bottom as you scroll down, so the last message becomes
  // focused once you reach the end.
  useEffect(() => {
    const container = scrollRef.current;
    const ids = threadKey.length === 0 ? [] : threadKey.split("|");
    if (container === null || ids.length === 0) {
      return undefined;
    } else {
      const update = () => {
        const containerTop = container.getBoundingClientRect().top;
        const scrollable = container.scrollHeight - container.clientHeight;
        const progress = scrollable <= 0 ? 0 : container.scrollTop / scrollable;
        const focusLine = progress * container.clientHeight;
        let crossedId: string | undefined;
        let crossedTop = Number.NEGATIVE_INFINITY;
        let firstId: string | undefined;
        let firstTop = Number.POSITIVE_INFINITY;
        for (const id of ids) {
          const element = messageRefs.current.get(id);
          if (element !== undefined) {
            const top = element.getBoundingClientRect().top - containerTop;
            if (top < firstTop) {
              firstTop = top;
              firstId = id;
            }
            if (top <= focusLine && top > crossedTop) {
              crossedTop = top;
              crossedId = id;
            }
          }
        }
        const focus = crossedId ?? firstId;
        if (focus !== undefined) {
          setFocusedMessageId(focus);
        }
      };
      update();
      container.addEventListener("scroll", update, { passive: true });
      return () => {
        container.removeEventListener("scroll", update);
      };
    }
  }, [threadKey]);

  return (
    <div className={pageStyles}>
      <TopBar
        chatId={snapshot.chat.id}
        isCreator={snapshot.currentUserRole === "creator"}
        members={members}
        title={snapshot.chat.title}
      />
      <div className={bodyStyles}>
        <div className={conversationStyles}>
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
                  <div
                    className={entryStyles}
                    data-message-id={entry.message.id}
                    key={entry.message.id}
                    ref={(element) => {
                      if (element === null) {
                        messageRefs.current.delete(entry.message.id);
                      } else {
                        messageRefs.current.set(entry.message.id, element);
                      }
                    }}
                  >
                    <MessageView
                      authorName={memberName(entry.message.authorUserId)}
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
        <ChatTreePanel
          activeMessageIds={activeMessageIds}
          branches={Object.values(state.branches)}
          currentMessageId={focusedInTree}
          members={state.members}
          messages={Object.values(state.messages)}
          onSelectMessage={jumpToMessage}
        />
      </div>
    </div>
  );
};

const pageStyles = css({
  blockSize: "100%",
  display: "flex",
  flex: 1,
  flexDirection: "column",
  minBlockSize: 0,
});

// Below the header the space splits horizontally: the conversation column
// (thread + composer) fills the room, the conversation tree rides alongside it.
const bodyStyles = css({
  display: "flex",
  flex: 1,
  minBlockSize: 0,
});

const conversationStyles = css({
  display: "flex",
  flex: 1,
  flexDirection: "column",
  minBlockSize: 0,
  minInlineSize: 0,
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
