"use client";

import { Button } from "@forkroom/component-library/Button";
import { Textarea } from "@forkroom/component-library/Textarea";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { useState } from "react";
import { css } from "../../styled-system/css";
import { submitPrompt } from "../client/api-client";
import type { ChatState } from "../client/chat-reducer";
import { messagesForBranch } from "../client/chat-reducer";
import { computeComposerMode } from "../client/composer-mode";
import type { BranchEntity } from "../contracts/chat-entities";

export type ForkPoint = { messageId: string; label: string };

type Props = {
  chatId: string;
  state: ChatState;
  leafBranch: BranchEntity;
  currentUserId: string;
  connected: boolean;
  forkPoint: ForkPoint | undefined;
  memberName: (userId: string | undefined) => string;
  onClearForkPoint: () => void;
  onSelectBranch: (branchId: string) => void;
};

/**
 * The composer at the foot of the thread. It states the outcome before
 * submission (send / fork), sends the prompt with an idempotency key and the
 * expected branch tip, and on a fork switches the view to the new branch.
 * Submitting on a branch you own extends it; on anyone else's, or from an
 * explicit point in history, it forks a new branch that becomes yours.
 */
export const Composer = ({
  chatId,
  state,
  leafBranch,
  currentUserId,
  connected,
  forkPoint,
  memberName,
  onClearForkPoint,
  onSelectBranch,
}: Props) => {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);

  const forkFromLabel = leafBranch.isMain
    ? "Main"
    : `${memberName(leafBranch.ownerUserId)}'s fork`;
  const mode = computeComposerMode({
    explicitFork: forkPoint !== undefined,
    forkFromLabel,
    ownsSelectedBranch: leafBranch.ownerUserId === currentUserId,
  });

  const local = messagesForBranch(state, leafBranch.id);
  const expectedTip = local.at(-1)?.id ?? leafBranch.forkMessageId ?? null;
  const branchBusy = Object.values(state.generations).some(
    (generation) =>
      generation.branchId === leafBranch.id &&
      (generation.status === "queued" || generation.status === "streaming"),
  );

  const busyBlocks = !mode.willFork && branchBusy;
  const canSubmit =
    connected && !pending && !busyBlocks && draft.trim().length > 0;

  const submit = () => {
    setPending(true);
    setError(undefined);
    submitPrompt(chatId, {
      content: draft,
      expectedTipMessageId: expectedTip,
      forkPointMessageId: forkPoint?.messageId ?? null,
      idempotencyKey: crypto.randomUUID(),
      selectedBranchId: leafBranch.id,
    })
      .then((result) => {
        if (result.ok) {
          setDraft("");
          onClearForkPoint();
          if (result.data.mode === "forked") {
            onSelectBranch(result.data.branchId);
          }
        } else if (result.error.code === "branch_tip_changed") {
          setError(
            "This chat changed since you loaded it. Review the latest messages, then send again.",
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
    busyBlocks,
    connected,
    modeLabel: mode.label,
  });

  return (
    <div className={rootStyles}>
      {forkPoint === undefined ? undefined : (
        <div className={forkChipStyles}>
          <span>Forking from {forkPoint.label}.</span>
          <Button
            label="Cancel fork"
            onClick={onClearForkPoint}
            size="xs"
            variant="ghost"
          >
            <XIcon />
          </Button>
        </div>
      )}
      <p aria-live="polite" className={statusStyles}>
        {statusMessage}
      </p>
      <div className={rowStyles}>
        <Textarea
          aria-label="Message"
          autoSize
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
  busyBlocks: boolean;
  connected: boolean;
  modeLabel: string;
}): string => {
  if (!input.connected) {
    return "Reconnecting… sending is paused.";
  } else if (input.busyBlocks) {
    return "A response is still generating on this fork.";
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
  inlineSize: "100%",
  marginInline: "auto",
  maxInlineSize: "3xl",
  paddingBlock: 3,
  paddingInline: 4,
});

const forkChipStyles = css({
  alignItems: "center",
  backgroundColor: "background",
  borderRadius: "md",
  color: "muted",
  display: "flex",
  fontSize: "xs",
  gap: 2,
  justifyContent: "space-between",
  paddingBlock: 1,
  paddingInline: 2,
});

const statusStyles = css({ color: "muted", fontSize: "xs" });

const rowStyles = css({
  alignItems: "flex-end",
  display: "flex",
  gap: 2,
});

const errorStyles = css({ color: "danger", fontSize: "sm" });
