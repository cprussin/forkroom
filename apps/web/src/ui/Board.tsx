"use client";

import { useState } from "react";
import { css } from "../../styled-system/css";
import { branchesInBoardOrder } from "../client/chat-reducer";
import { useChatStream } from "../client/use-chat-stream";
import type { ChatSnapshot } from "../contracts/chat-snapshot";
import { BranchColumn } from "./BranchColumn";
import { Composer } from "./Composer";
import { ReconnectingBanner } from "./ReconnectingBanner";
import { TopBar } from "./TopBar";

/**
 * The live branch board. Holds the selected branch (which scopes the composer),
 * renders every branch as a side-by-side column, and stays current through the
 * realtime stream. The database snapshot is the initial and canonical state.
 */
export const Board = ({ snapshot }: { snapshot: ChatSnapshot }) => {
  const { state, connected } = useChatStream(snapshot);
  const [selectedId, setSelectedId] = useState(snapshot.chat.mainBranchId);

  const branches = branchesInBoardOrder(state);
  const selectedBranch =
    state.branches[selectedId] ?? state.branches[snapshot.chat.mainBranchId];
  const memberCount = Object.keys(state.members).length;

  const memberName = (userId: string | undefined): string => {
    if (userId === undefined) {
      return "Unknown";
    } else if (userId === snapshot.currentUserId) {
      return "You";
    } else {
      return state.members[userId]?.displayName ?? "A member";
    }
  };

  return (
    <div className={pageStyles}>
      <TopBar
        chatId={snapshot.chat.id}
        isCreator={snapshot.currentUserRole === "creator"}
        memberCount={memberCount}
        title={snapshot.chat.title}
      />
      {connected ? undefined : <ReconnectingBanner />}
      <p aria-live="polite" className={srOnlyStyles}>
        {`${branches.length.toString()} branches in this chat.`}
      </p>
      <div aria-label="Branches" className={boardStyles} role="list">
        {branches.map((branch) => (
          <div key={branch.id} role="listitem">
            <BranchColumn
              branch={branch}
              memberName={memberName}
              onSelect={setSelectedId}
              selected={branch.id === selectedId}
              state={state}
            />
          </div>
        ))}
      </div>
      {selectedBranch === undefined ? undefined : (
        <Composer
          chatId={snapshot.chat.id}
          connected={connected}
          currentUserId={snapshot.currentUserId}
          currentUserRole={snapshot.currentUserRole}
          memberName={memberName}
          onSelectBranch={setSelectedId}
          selectedBranch={selectedBranch}
          state={state}
        />
      )}
    </div>
  );
};

const pageStyles = css({
  blockSize: "100dvh",
  display: "flex",
  flexDirection: "column",
});

const boardStyles = css({
  alignItems: "stretch",
  display: "flex",
  flex: 1,
  gap: 3,
  minBlockSize: 0,
  overflowX: "auto",
  overflowY: "hidden",
  padding: 3,
});

const srOnlyStyles = css({
  border: 0,
  clip: "rect(0 0 0 0)",
  height: "1px",
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  width: "1px",
});
