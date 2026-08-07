"use client";

import { Button } from "@forkroom/component-library/Button";
import { Textarea } from "@forkroom/component-library/Textarea";
import { ArrowUpIcon } from "@phosphor-icons/react/dist/ssr/ArrowUp";
import type { ReactNode } from "react";
import { css } from "../../styled-system/css";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  pending: boolean;
  placeholder?: string;
  sendLabel?: string;
  sendIcon?: ReactNode;
  autoFocus?: boolean;
};

/**
 * The ChatGPT-style message input: a single rounded auto-growing field with the
 * send control tucked inside it. Enter sends; Shift+Enter inserts a newline;
 * IME composition is respected so a committing keystroke never submits.
 */
export const ComposerInput = ({
  value,
  onChange,
  onSubmit,
  canSubmit,
  pending,
  placeholder = "Message forkroom…",
  sendLabel = "Send",
  sendIcon,
  autoFocus = false,
}: Props) => (
  <Textarea
    aria-label="Message"
    autoFocus={autoFocus}
    autoSize
    maxHeight={200}
    minHeight={52}
    onChange={(event) => {
      onChange(event.target.value);
    }}
    onKeyDown={(event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault();
        if (canSubmit) {
          onSubmit();
        }
      }
    }}
    placeholder={placeholder}
    rounded
    suffixButtons={
      <span className={sendStyles}>
        <Button
          disabled={!canSubmit}
          label={sendLabel}
          loading={pending}
          onClick={onSubmit}
          rounded
          size="sm"
          variant="primary"
        >
          {sendIcon ?? <ArrowUpIcon weight="bold" />}
        </Button>
      </span>
    }
    value={value}
  />
);

const sendStyles = css({ display: "inline-flex", paddingBlockEnd: 1 });
