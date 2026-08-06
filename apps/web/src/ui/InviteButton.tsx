"use client";

import { Button } from "@forkroom/component-library/Button";
import { ModalDialog } from "@forkroom/component-library/ModalDialog";
import { useState } from "react";
import { css } from "../../styled-system/css";
import { createInvite } from "../client/api-client";

/**
 * Creator-only invitation control. Generates a shareable link on demand; the
 * raw token is shown once (only its hash is stored server-side) and can be
 * copied. Errors surface inline.
 */
export const InviteButton = ({ chatId }: { chatId: string }) => {
  const [link, setLink] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = () => {
    setPending(true);
    setError(undefined);
    createInvite(chatId)
      .then((result) => {
        if (result.ok) {
          setLink(`${window.location.origin}/invite/${result.data.token}`);
        } else {
          setError(result.error.title);
        }
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : "Failed to create invite",
        );
      })
      .finally(() => {
        setPending(false);
      });
  };

  const copy = () => {
    if (link !== undefined) {
      navigator.clipboard
        .writeText(link)
        .then(() => {
          setCopied(true);
        })
        .catch(() => {
          setError("Could not copy to clipboard");
        });
    }
  };

  return (
    <ModalDialog
      title="Invite to this chat"
      trigger={<Button size="sm">Invite</Button>}
    >
      <div className={bodyStyles}>
        <p className={descStyles}>
          Anyone with the link can sign in and join. The link is valid for seven
          days and can be revoked.
        </p>
        <Button loading={pending} onClick={generate} variant="outline">
          Generate invite link
        </Button>
        {link === undefined ? undefined : (
          <div className={linkRowStyles}>
            <code className={linkStyles}>{link}</code>
            <Button onClick={copy} size="sm" variant="outline">
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        )}
        {error === undefined ? undefined : (
          <p className={errorStyles} role="alert">
            {error}
          </p>
        )}
      </div>
    </ModalDialog>
  );
};

const bodyStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: 3,
  maxInlineSize: 120,
});

const descStyles = css({ color: "muted", fontSize: "sm" });

const linkRowStyles = css({ alignItems: "center", display: "flex", gap: 2 });

const linkStyles = css({
  backgroundColor: "card",
  borderRadius: "sm",
  flex: 1,
  fontFamily: "mono",
  fontSize: "xs",
  overflowX: "auto",
  padding: 2,
  whiteSpace: "nowrap",
});

const errorStyles = css({ color: "danger", fontSize: "sm" });
