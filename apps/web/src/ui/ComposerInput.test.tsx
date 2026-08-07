import { describe, expect, it } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { ComposerInput } from "./ComposerInput";

const noop = () => undefined;

describe("ComposerInput", () => {
  it("submits on Enter when allowed", async () => {
    const submitted = await new Promise<boolean>((resolve) => {
      render(
        <ComposerInput
          canSubmit
          onChange={noop}
          onSubmit={() => {
            resolve(true);
          }}
          pending={false}
          value="hello"
        />,
      );
      fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    });
    expect(submitted).toBe(true);
  });

  it("does not submit on Shift+Enter (newline)", () => {
    let submitted = false;
    render(
      <ComposerInput
        canSubmit
        onChange={noop}
        onSubmit={() => {
          submitted = true;
        }}
        pending={false}
        value="hello"
      />,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      shiftKey: true,
    });
    expect(submitted).toBe(false);
  });

  it("disables the send button when submission is not allowed", () => {
    render(
      <ComposerInput
        canSubmit={false}
        onChange={noop}
        onSubmit={noop}
        pending={false}
        value=""
      />,
    );
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });
});
