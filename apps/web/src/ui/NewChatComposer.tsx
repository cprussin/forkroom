"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { css } from "../../styled-system/css";
import { createChat, submitPrompt } from "../client/api-client";
import { ComposerInput } from "./ComposerInput";

/**
 * The empty-state composer that starts a new chat. The first message both
 * creates the chat and seeds it — the chat is named from this message
 * server-side — then navigates into it. No up-front title prompt.
 */
export const NewChatComposer = () => {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const canSubmit = !pending && draft.trim().length > 0;

  const start = () => {
    setPending(true);
    setError(undefined);
    const content = draft;
    createChat()
      .then((created) => {
        if (created.ok) {
          return submitPrompt(created.data.chatId, {
            content,
            expectedTipMessageId: null,
            idempotencyKey: crypto.randomUUID(),
            selectedBranchId: created.data.mainBranchId,
          }).then((sent) => {
            if (sent.ok) {
              router.push(`/chats/${created.data.chatId}`);
            } else {
              setError(sent.error.title);
              setPending(false);
            }
          });
        } else {
          setError(created.error.title);
          setPending(false);
          return undefined;
        }
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : "Failed to start chat",
        );
        setPending(false);
      });
  };

  return (
    <div className={rootStyles}>
      <ComposerInput
        autoFocus
        canSubmit={canSubmit}
        onChange={setDraft}
        onSubmit={start}
        pending={pending}
        placeholder="Ask anything…"
        value={draft}
      />
      {error === undefined ? undefined : (
        <p className={errorStyles} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

const rootStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: 1.5,
  inlineSize: "100%",
  maxInlineSize: "3xl",
});

const errorStyles = css({
  color: "danger",
  fontSize: "sm",
  textAlign: "center",
});
