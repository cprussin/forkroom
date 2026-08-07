import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Tooltip } from "./Tooltip";

describe(Tooltip, () => {
  it("renders the trigger", () => {
    render(
      <Tooltip trigger={<button type="button">Anchor</button>}>Hint</Tooltip>,
    );
    expect(screen.getByRole("button", { name: "Anchor" })).toBeInTheDocument();
  });

  it("keeps the hint hidden while at rest", () => {
    render(
      <Tooltip trigger={<button type="button">Anchor</button>}>Hint</Tooltip>,
    );
    expect(screen.queryByText("Hint")).not.toBeInTheDocument();
  });

  it("shows the hint when controlled open", async () => {
    render(
      <Tooltip open trigger={<button type="button">Anchor</button>}>
        Hint
      </Tooltip>,
    );
    expect(await screen.findByText("Hint")).toBeInTheDocument();
  });

  it("reveals the hint on hover", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip delay={0} trigger={<button type="button">Anchor</button>}>
        Hint
      </Tooltip>,
    );
    await user.hover(screen.getByRole("button", { name: "Anchor" }));
    expect(await screen.findByText("Hint")).toBeInTheDocument();
  });
});
