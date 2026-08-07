"use client";

import { Button } from "@forkroom/component-library/Button";
import { Kbd } from "@forkroom/component-library/Kbd";
import { Textarea } from "@forkroom/component-library/Textarea";
import { ArrowUpIcon } from "@phosphor-icons/react/dist/ssr/ArrowUp";
import { NotePencilIcon } from "@phosphor-icons/react/dist/ssr/NotePencil";
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
  hint?: boolean;
};

/**
 * The ChatGPT-style message input: a single rounded auto-growing field that
 * sits on a lifted card, with a note-pencil prefix and the send control tucked
 * inside it. Enter sends; Shift+Enter inserts a newline; IME composition is
 * respected so a committing keystroke never submits. Pass `hint` to show the
 * keyboard help line beneath the field.
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
  hint = false,
}: Props) => (
  <div className={rootStyles}>
    <div className={shadowWrapperStyles}>
      <Textarea
        aria-label="Message"
        autoFocus={autoFocus}
        autoSize
        clearable
        maxHeight={60}
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
        prefixIcon={<NotePencilIcon />}
        rounded
        size="lg"
        suffixButtons={
          <span className={sendStyles}>
            <Button
              disabled={!canSubmit}
              label={sendLabel}
              loading={pending}
              onClick={onSubmit}
              rounded
              size="md"
              variant="primary"
            >
              {sendIcon ?? <ArrowUpIcon weight="bold" />}
            </Button>
          </span>
        }
        value={value}
      />
    </div>
    {hint ? (
      <p className={hintStyles}>
        Press <Kbd>Enter</Kbd> to send, <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> for a
        newline.
      </p>
    ) : undefined}
  </div>
);

const rootStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  inlineSize: "100%",
});

// Lifts the field off the page the way argo-desktop's composer does. The
// border radius matches the Textarea's `rounded` + `size="lg"` shape
// (`spacing.5`) so the shadow follows the rounded outline instead of clipping
// to a square.
const shadowWrapperStyles = css({
  borderRadius: "{spacing.5}",
  boxShadow: "lifted",
});

const sendStyles = css({ display: "inline-flex", paddingBlockEnd: 1 });

const hintStyles = css({
  color: "muted",
  fontSize: "xs",
  letterSpacing: "wide",
  textAlign: "center",
});
