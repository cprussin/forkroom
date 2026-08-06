"use client";

import { Button } from "@forkroom/component-library/Button";
import { Input } from "@forkroom/component-library/Input";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { css } from "../../styled-system/css";
import { createChat } from "../client/api-client";

/** Signed-in landing: name a chat and open its board as creator. */
export const CreateChatForm = () => {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const create = () => {
    setPending(true);
    setError(undefined);
    createChat(title.trim())
      .then((result) => {
        if (result.ok) {
          router.push(`/chats/${result.data.chatId}`);
        } else {
          setError(result.error.title);
          setPending(false);
        }
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : "Failed to create chat",
        );
        setPending(false);
      });
  };

  return (
    <>
      <div>
        <h1 className={headingStyles}>Start a chat</h1>
        <p className={subStyles}>
          You become the creator. Invite others and watch branches appear as
          they reply.
        </p>
      </div>
      <div className={rowStyles}>
        <Input
          aria-label="Chat title"
          maxLength={120}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          placeholder="e.g. Trip planning ideas"
          value={title}
        />
        <Button
          disabled={title.trim().length === 0 || pending}
          loading={pending}
          onClick={create}
          variant="primary"
        >
          Create
        </Button>
      </div>
      {error === undefined ? undefined : (
        <p className={errorStyles} role="alert">
          {error}
        </p>
      )}
    </>
  );
};

const headingStyles = css({ fontSize: "2xl", fontWeight: "bold" });
const subStyles = css({ color: "muted", fontSize: "sm", marginBlockStart: 1 });
const rowStyles = css({ display: "flex", gap: 2 });
const errorStyles = css({ color: "danger", fontSize: "sm" });
