import { describe, expect, it } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BranchTreeNode } from "../client/branch-tree";
import { ForkNavigator } from "./ForkNavigator";

const node = (
  branchId: string,
  ownerUserId: string,
  isMain: boolean,
  depth: number,
): BranchTreeNode => ({ branchId, depth, isMain, ownerUserId });

const tree: BranchTreeNode[] = [
  node("main", "dana", true, 0),
  node("forkA", "alice", false, 1),
  node("nested", "bob", false, 2),
];

const names: Record<string, string> = {
  alice: "Alice",
  bob: "Bob",
  dana: "Dana",
};
const ownerName = (userId: string): string => names[userId] ?? "Someone";

describe("ForkNavigator", () => {
  it("counts the forks in the header pill", () => {
    render(
      <ForkNavigator
        currentBranchId="main"
        nodes={tree}
        onSelectBranch={() => undefined}
        ownerName={ownerName}
      />,
    );
    expect(screen.getByText("2 forks")).toBeInTheDocument();
  });

  it("uses the singular for a lone fork", () => {
    render(
      <ForkNavigator
        currentBranchId="main"
        nodes={[
          node("main", "dana", true, 0),
          node("forkA", "alice", false, 1),
        ]}
        onSelectBranch={() => undefined}
        ownerName={ownerName}
      />,
    );
    expect(screen.getByText("1 fork")).toBeInTheDocument();
  });

  it("renders nothing when the chat has no forks", () => {
    render(
      <ForkNavigator
        currentBranchId="main"
        nodes={[node("main", "dana", true, 0)]}
        onSelectBranch={() => undefined}
        ownerName={ownerName}
      />,
    );
    expect(screen.queryByText(/fork/)).not.toBeInTheDocument();
  });

  it("lists the trunk and every fork, nested ones included, on hover", async () => {
    const user = userEvent.setup();
    render(
      <ForkNavigator
        currentBranchId="main"
        nodes={tree}
        onSelectBranch={() => undefined}
        ownerName={ownerName}
      />,
    );
    await user.hover(screen.getByRole("button", { name: /forks/ }));
    expect(await screen.findByRole("list")).toBeInTheDocument();
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Alice's fork")).toBeInTheDocument();
    expect(screen.getByText("Bob's fork")).toBeInTheDocument();
  });

  it("jumps to a fork's thread when its row is chosen", async () => {
    const user = userEvent.setup();
    const selected: string[] = [];
    render(
      <ForkNavigator
        currentBranchId="main"
        nodes={tree}
        onSelectBranch={(branchId) => {
          selected.push(branchId);
        }}
        ownerName={ownerName}
      />,
    );
    await user.hover(screen.getByRole("button", { name: /forks/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Bob's fork/ }));
    expect(selected).toEqual(["nested"]);
  });
});
