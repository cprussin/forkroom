import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Popover } from "./Popover";

describe(Popover, () => {
  it("renders the trigger", () => {
    render(
      <Popover trigger={<button type="button">Open</button>}>Content</Popover>,
    );
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("keeps the content hidden while closed", () => {
    render(
      <Popover trigger={<button type="button">Open</button>}>Content</Popover>,
    );
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("shows the content when controlled open", async () => {
    render(
      <Popover open trigger={<button type="button">Open</button>}>
        Content
      </Popover>,
    );
    expect(await screen.findByText("Content")).toBeInTheDocument();
  });

  it("opens the content when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<button type="button">Open</button>}>Content</Popover>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByText("Content")).toBeInTheDocument();
  });

  it("forwards additional root props to base-ui", async () => {
    const user = userEvent.setup();
    let opened: boolean | undefined;
    render(
      <Popover
        onOpenChange={(open) => {
          opened = open;
        }}
        trigger={<button type="button">Open</button>}
      >
        Content
      </Popover>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByText("Content");
    expect(opened).toBe(true);
  });
});
