import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForkDeck } from "./ForkDeck";

const variants = [
  {
    branchId: "main",
    label: "Main",
    ownerUserId: "dana",
    preview: "The trunk continues here",
  },
  {
    branchId: "forkA",
    label: "Alice's fork",
    ownerUserId: "alice",
    preview: "Alice tried another way",
  },
  {
    branchId: "forkB",
    label: "Bob's fork",
    ownerUserId: "bob",
    preview: "Bob went a third direction",
  },
];

const ownerNames: Record<string, string> = {
  alice: "Alice",
  bob: "Bob",
  dana: "Dana",
};
const ownerName = (userId: string): string => ownerNames[userId] ?? "Someone";

describe("ForkDeck", () => {
  it("shows a card for every variant with its preview", () => {
    render(
      <ForkDeck
        activeBranchId="main"
        onSelectBranch={() => undefined}
        ownerName={ownerName}
        variants={variants}
      />,
    );
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Alice tried another way")).toBeInTheDocument();
    expect(screen.getByText("Bob went a third direction")).toBeInTheDocument();
  });

  it("marks the selected conversation as the top of the stack", () => {
    render(
      <ForkDeck
        activeBranchId="forkA"
        onSelectBranch={() => undefined}
        ownerName={ownerName}
        variants={variants}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Alice's fork/ }),
    ).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /Main/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("switches to a conversation when its card is clicked", async () => {
    const selected = await new Promise<string>((resolve) => {
      render(
        <ForkDeck
          activeBranchId="main"
          onSelectBranch={resolve}
          ownerName={ownerName}
          variants={variants}
        />,
      );
      void userEvent.click(screen.getByRole("button", { name: /Bob's fork/ }));
    });
    expect(selected).toBe("forkB");
  });
});
