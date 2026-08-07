import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ForkSwitch } from "../client/thread-view";
import { ForkSwitcher } from "./ForkSwitcher";

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

describe("ForkSwitcher", () => {
  it("shows the active variant and its position", () => {
    render(
      <ForkSwitcher
        fork={fork}
        memberName={memberName}
        onSelectBranch={() => undefined}
        ownerName={ownerName}
      />,
    );
    expect(screen.getByText(/Main/)).toBeInTheDocument();
    expect(screen.getByText(/1.*3/)).toBeInTheDocument();
  });

  it("moves to the next variant", async () => {
    const selected = await new Promise<string>((resolve) => {
      render(
        <ForkSwitcher
          fork={fork}
          memberName={memberName}
          onSelectBranch={resolve}
          ownerName={ownerName}
        />,
      );
      userEvent.click(screen.getByRole("button", { name: /next fork/i }));
    });
    expect(selected).toBe("forkA");
  });

  it("disables the previous control on the first variant", () => {
    render(
      <ForkSwitcher
        fork={fork}
        memberName={memberName}
        onSelectBranch={() => undefined}
        ownerName={ownerName}
      />,
    );
    expect(
      screen.getByRole("button", { name: /previous fork/i }),
    ).toBeDisabled();
  });

  describe("owner facepile", () => {
    it("renders an avatar for every variant's owner", () => {
      render(
        <ForkSwitcher
          fork={fork}
          memberName={memberName}
          onSelectBranch={() => undefined}
          ownerName={ownerName}
        />,
      );
      expect(screen.getByTitle("Main")).toBeInTheDocument();
      expect(screen.getByTitle("Alice's fork")).toBeInTheDocument();
      expect(screen.getByTitle("Bob's fork")).toBeInTheDocument();
    });

    it("derives each avatar from the owner's name, trunk included", () => {
      render(
        <ForkSwitcher
          fork={fork}
          memberName={memberName}
          onSelectBranch={() => undefined}
          ownerName={ownerName}
        />,
      );
      // The trunk shows its owner's initial ("Dana"), not "Main"; forks show
      // their owner's initial rather than a "You"/role placeholder.
      expect(screen.getByText("D")).toBeInTheDocument();
      expect(screen.getByText("A")).toBeInTheDocument();
      expect(screen.getByText("B")).toBeInTheDocument();
      expect(screen.queryByText("M")).not.toBeInTheDocument();
    });

    it("activates a fork when its avatar is clicked", async () => {
      const selected = await new Promise<string>((resolve) => {
        render(
          <ForkSwitcher
            fork={fork}
            memberName={memberName}
            onSelectBranch={resolve}
            ownerName={ownerName}
          />,
        );
        userEvent.click(screen.getByRole("button", { name: "Bob's fork" }));
      });
      expect(selected).toBe("forkB");
    });

    it("marks the active variant's owner", () => {
      render(
        <ForkSwitcher
          fork={fork}
          memberName={memberName}
          onSelectBranch={() => undefined}
          ownerName={ownerName}
        />,
      );
      expect(screen.getByTitle("Main")).toHaveAttribute("data-active", "");
      expect(screen.getByTitle("Alice's fork")).not.toHaveAttribute(
        "data-active",
      );
    });
  });
});
