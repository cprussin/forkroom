import { describe, expect, it } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { BranchEntity } from "../contracts/chat-entities";
import { BranchGraphPanel } from "./BranchGraphPanel";

const branch = (
  id: string,
  ownerUserId: string,
  parentBranchId: string | undefined,
  createdAt: string,
): BranchEntity => ({
  chatId: "chat",
  createdAt,
  createdByUserId: ownerUserId,
  forkMessageId: parentBranchId === undefined ? undefined : "m",
  id,
  isMain: parentBranchId === undefined,
  ownerUserId,
  parentBranchId,
});

const branches: BranchEntity[] = [
  branch("main", "dana", undefined, "2026-08-01"),
  branch("forkA", "alice", "main", "2026-08-02"),
  branch("nested", "bob", "forkA", "2026-08-03"),
];

const names: Record<string, string> = {
  alice: "Alice",
  bob: "Bob",
  dana: "Dana",
};
const ownerName = (userId: string): string => names[userId] ?? "Someone";

describe("BranchGraphPanel", () => {
  it("draws the trunk and every fork as nodes", () => {
    render(
      <BranchGraphPanel
        branches={branches}
        currentBranchId="main"
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

  it("marks the branch currently being viewed", () => {
    render(
      <BranchGraphPanel
        branches={branches}
        currentBranchId="forkA"
        onSelectBranch={() => undefined}
        ownerName={ownerName}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Alice's fork" }),
    ).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Main" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("navigates to a branch when its node is chosen", () => {
    const selected: string[] = [];
    render(
      <BranchGraphPanel
        branches={branches}
        currentBranchId="main"
        onSelectBranch={(branchId) => {
          selected.push(branchId);
        }}
        ownerName={ownerName}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Bob's fork" }));
    expect(selected).toEqual(["nested"]);
  });

  it("renders nothing when the chat has no forks", () => {
    const { container } = render(
      <BranchGraphPanel
        branches={[branch("main", "dana", undefined, "2026-08-01")]}
        currentBranchId="main"
        onSelectBranch={() => undefined}
        ownerName={ownerName}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
