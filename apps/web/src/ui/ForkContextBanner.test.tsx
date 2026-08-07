import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForkContextBanner } from "./ForkContextBanner";

describe("ForkContextBanner", () => {
  it("names the fork's owner", () => {
    render(
      <ForkContextBanner onReturnToMain={() => undefined} ownerName="Alice" />,
    );
    expect(screen.getByText(/Alice's fork/)).toBeInTheDocument();
  });

  it("exposes itself to assistive tech as a status region", () => {
    render(
      <ForkContextBanner onReturnToMain={() => undefined} ownerName="Alice" />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("returns to main when the button is clicked", async () => {
    await new Promise<void>((resolve) => {
      render(<ForkContextBanner onReturnToMain={resolve} ownerName="Alice" />);
      userEvent.click(screen.getByRole("button", { name: /back to main/i }));
    });
  });
});
