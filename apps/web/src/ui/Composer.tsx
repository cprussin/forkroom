"use client";

import { Button } from "@forkroom/component-library/Button";
import { Textarea } from "@forkroom/component-library/Textarea";
import { useState } from "react";
import { css } from "../../styled-system/css";
import { submitPrompt } from "../client/api-client";
import type { ChatState } from "../client/chat-reducer";
import { messagesForBranch } from "../client/chat-reducer";
import { computeComposerMode } from "../client/composer-mode";
import type { BranchEntity } from "../contracts/chat-entities";

type Props = {
  chatId: string;
  state: ChatState;
  selectedBranch: BranchEntity;
  currentUserId: string;
  currentUserRole: "creator" | "participant";
  connected: boolean;
  memberName: (userId: string | undefined) => string;
  onSelectBranch: (branchId: string) => void;
};

/**
 * The branch-scoped composer. It states the outcome before submission (reply /
 * continue / fork / blocked), sends the prompt with an idempotency key and the
 * expected branch tip, and on a fork switches the view to the new branch. A
 * stale-tip conflict keeps the draft and asks the user to review.
 */
export const Composer = ({
  chatId,
  state,
  selectedBranch,
  currentUserId,
  currentUserRole,
  connected,
  memberName,
  onSelectBranch,
}: Props) => {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);

  const forkFromLabel = selectedBranch.isMain
    ? "Main"
    : `${memberName(selectedBranch.ownerUserId)}'s branch`;
  const mode = computeComposerMode({
    forkFromLabel,
    isCreator: currentUserRole === "creator",
    ownsSelectedBranch: selectedBranch.ownerUserId === currentUserId,
    selectedIsMain: selectedBranch.isMain,
  });

  const local = messagesForBranch(state, selectedBranch.id);
  const expectedTip = local.at(-1)?.id ?? selectedBranch.forkMessageId ?? null;
  const branchBusy = Object.values(state.generations).some(
    (generation) =>
      generation.branchId === selectedBranch.id &&
      (generation.status === "queued" || generation.status === "streaming"),
  );

  const blocked = mode.status === "blocked";
  const busyBlocks = !mode.willFork && branchBusy;
  const canSubmit =
    !blocked && connected && !pending && !busyBlocks && draft.trim().length > 0;

  const submit = () => {
    setPending(true);
    setError(undefined);
    submitPrompt(chatId, {
      content: draft,
      expectedTipMessageId: expectedTip,
      idempotencyKey: crypto.randomUUID(),
      selectedBranchId: selectedBranch.id,
    })
      .then((result) => {
        if (result.ok) {
          setDraft("");
          if (result.data.mode === "forked") {
            onSelectBranch(result.data.branchId);
          }
        } else if (result.error.code === "branch_tip_changed") {
          setError(
            "This branch changed since you loaded it. Review the latest messages, then send again.",
          );
        } else {
          setError(result.error.title);
        }
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Failed to send");
      })
      .finally(() => {
        setPending(false);
      });
  };

  const statusMessage = getStatusMessage({
    blocked,
    busyBlocks,
    connected,
    modeLabel: mode.label,
  });

  return (
    <div className={rootStyles}>
      <p aria-live="polite" className={statusStyles}>
        {statusMessage}
      </p>
      <div className={rowStyles}>
        <Textarea
          aria-label="Message"
          autoSize
          disabled={blocked}
          maxHeight={200}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (event.metaKey || event.ctrlKey) &&
              canSubmit
            ) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Type a message…  (⌘/Ctrl + Enter to send)"
          value={draft}
        />
        <Button
          disabled={!canSubmit}
          loading={pending}
          onClick={submit}
          variant="primary"
        >
          {mode.willFork ? "Fork" : "Send"}
        </Button>
      </div>
      {error === undefined ? undefined : (
        <p className={errorStyles} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

const getStatusMessage = (input: {
  blocked: boolean;
  busyBlocks: boolean;
  connected: boolean;
  modeLabel: string;
}): string => {
  if (!input.connected) {
    return "Reconnecting… sending is paused.";
  } else if (input.blocked) {
    return input.modeLabel;
  } else if (input.busyBlocks) {
    return "A response is still generating on this branch.";
  } else {
    return input.modeLabel;
  }
};

const rootStyles = css({
  backgroundColor: "card",
  borderBlockStart: "1px solid {colors.border}",
  boxShadow: "lifted",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: 3,
});

const statusStyles = css({ color: "muted", fontSize: "xs" });

const rowStyles = css({
  alignItems: "flex-end",
  display: "flex",
  gap: 2,
});

const errorStyles = css({ color: "danger", fontSize: "sm" });
