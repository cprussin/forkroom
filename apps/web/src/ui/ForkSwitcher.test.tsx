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

describe("ForkSwitcher", () => {
  it("shows the active variant and its position", () => {
    render(
      <ForkSwitcher
        fork={fork}
        memberName={memberName}
        onSelectBranch={() => undefined}
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
      />,
    );
    expect(
      screen.getByRole("button", { name: /previous fork/i }),
    ).toBeDisabled();
  });
});
