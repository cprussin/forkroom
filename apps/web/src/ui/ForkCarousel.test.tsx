import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CarouselFork } from "./ForkCarousel";
import { ForkCarousel } from "./ForkCarousel";

const forks: CarouselFork[] = [
  {
    branchId: "main",
    content: <p>Trunk conversation</p>,
    label: "Main",
    ownerUserId: "dana",
  },
  {
    branchId: "forkA",
    content: <p>Alice's conversation</p>,
    label: "Alice's fork",
    ownerUserId: "alice",
  },
  {
    branchId: "forkB",
    content: <p>Bob's conversation</p>,
    label: "Bob's fork",
    ownerUserId: "bob",
  },
];

const ownerNames: Record<string, string> = {
  alice: "Alice",
  bob: "Bob",
  dana: "Dana",
};
const ownerName = (userId: string): string => ownerNames[userId] ?? "Someone";

describe("ForkCarousel", () => {
  it("lays out every conversation with its content", () => {
    render(
      <ForkCarousel
        activeBranchId="main"
        forks={forks}
        onSelectBranch={() => undefined}
        ownerName={ownerName}
      />,
    );
    expect(screen.getByText("Trunk conversation")).toBeInTheDocument();
    expect(screen.getByText("Alice's conversation")).toBeInTheDocument();
    expect(screen.getByText("Bob's conversation")).toBeInTheDocument();
  });

  it("marks the centred conversation", () => {
    render(
      <ForkCarousel
        activeBranchId="forkA"
        forks={forks}
        onSelectBranch={() => undefined}
        ownerName={ownerName}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Alice's fork/ }),
    ).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /Main/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("slides a side conversation to the middle when its header is clicked", async () => {
    const selected = await new Promise<string>((resolve) => {
      render(
        <ForkCarousel
          activeBranchId="main"
          forks={forks}
          onSelectBranch={resolve}
          ownerName={ownerName}
        />,
      );
      void userEvent.click(screen.getByRole("button", { name: /Bob's fork/ }));
    });
    expect(selected).toBe("forkB");
  });
});
