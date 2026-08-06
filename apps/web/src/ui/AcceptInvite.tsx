"use client";

import { Button } from "@forkroom/component-library/Button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { css } from "../../styled-system/css";
import { acceptInvite } from "../client/api-client";

type Props = {
  token: string;
  chatTitle: string;
  creatorDisplayName: string;
};

/**
 * Invitation acceptance. Shows the chat title and creator before joining. An
 * unauthenticated user is redirected to sign in and returned here afterwards
 * (PRD §7.3).
 */
export const AcceptInvite = ({
  token,
  chatTitle,
  creatorDisplayName,
}: Props) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const accept = () => {
    setPending(true);
    setError(undefined);
    acceptInvite(token)
      .then((result) => {
        if (result.ok) {
          router.push(`/chats/${result.data.chatId}`);
        } else if (result.error.code === "unauthenticated") {
          router.push(`/signin?callbackUrl=/invite/${token}`);
        } else {
          setError(result.error.title);
          setPending(false);
        }
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Failed to accept");
        setPending(false);
      });
  };

  return (
    <>
      <div>
        <p className={eyebrowStyles}>You&apos;re invited to</p>
        <h1 className={headingStyles}>{chatTitle}</h1>
        <p className={subStyles}>Created by {creatorDisplayName}</p>
      </div>
      <Button loading={pending} onClick={accept} variant="primary">
        Accept &amp; join
      </Button>
      {error === undefined ? undefined : (
        <p className={errorStyles} role="alert">
          {error}
        </p>
      )}
    </>
  );
};

const eyebrowStyles = css({
  color: "muted",
  fontSize: "xs",
  textTransform: "uppercase",
});
const headingStyles = css({ fontSize: "2xl", fontWeight: "bold" });
const subStyles = css({ color: "muted", fontSize: "sm", marginBlockStart: 1 });
const errorStyles = css({ color: "danger", fontSize: "sm" });
