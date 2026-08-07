import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ForkSwitch } from "../client/thread-view";
import { ForkStack } from "./ForkStack";

const fork: ForkSwitch = {
  activeBranchId: "main",
  variants: [
    { branchId: "main", isMain: true, ownerUserId: "creator" },
    { branchId: "forkA", isMain: false, ownerUserId: "alice" },
    { branchId: "forkB", isMain: false, ownerUserId: "bob" },
  ],
};

const names: Record<string, string> = { alice: "Alice", bob: "Bob" };
const memberName = (userId: string | undefined): string =>
  userId === undefined ? "Creator" : (names[userId] ?? "Creator");

const ownerNames: Record<string, string> = {
  alice: "Alice",
  bob: "Bob",
  creator: "Dana",
};
const ownerName = (userId: string): string => ownerNames[userId] ?? "Someone";

describe("ForkStack", () => {
  it("shows a card for every variant", () => {
    render(
      <ForkStack
        fork={fork}
        memberName={memberName}
        onSelectBranch={() => undefined}
        ownerName={ownerName}
      />,
    );
    expect(screen.getByRole("button", { name: "Main" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Alice's fork" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bob's fork" }),
    ).toBeInTheDocument();
  });

  it("counts the versions in the stack", () => {
    render(
      <ForkStack
        fork={fork}
        memberName={memberName}
        onSelectBranch={() => undefined}
        ownerName={ownerName}
      />,
    );
    expect(screen.getByText(/3 versions/)).toBeInTheDocument();
  });

  it("marks the active variant and no other", () => {
    render(
      <ForkStack
        fork={fork}
        memberName={memberName}
        onSelectBranch={() => undefined}
        ownerName={ownerName}
      />,
    );
    expect(screen.getByRole("button", { name: "Main" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Alice's fork" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("switches to a variant when its card is clicked", async () => {
    const selected = await new Promise<string>((resolve) => {
      render(
        <ForkStack
          fork={fork}
          memberName={memberName}
          onSelectBranch={resolve}
          ownerName={ownerName}
        />,
      );
      void userEvent.click(screen.getByRole("button", { name: "Bob's fork" }));
    });
    expect(selected).toBe("forkB");
  });
});
