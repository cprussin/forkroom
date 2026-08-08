import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StackPeek } from "./ThreadStack";
import { ThreadStack } from "./ThreadStack";

const peeks: StackPeek[] = [
  { branchId: "main", label: "Main", ownerUserId: "dana" },
  { branchId: "forkB", label: "Bob's fork", ownerUserId: "bob" },
];

const ownerNames: Record<string, string> = {
  bob: "Bob",
  dana: "Dana",
};
const ownerName = (userId: string): string => ownerNames[userId] ?? "Someone";

describe("ThreadStack", () => {
  it("renders the selected thread's content on top", () => {
    render(
      <ThreadStack
        activeBranchId="main"
        onSelectBranch={() => undefined}
        ownerName={ownerName}
        peeks={peeks}
      >
        <p>Active conversation</p>
      </ThreadStack>,
    );
    expect(screen.getByText("Active conversation")).toBeInTheDocument();
  });

  it("offers a switch control for each peeking conversation", () => {
    render(
      <ThreadStack
        activeBranchId="main"
        onSelectBranch={() => undefined}
        ownerName={ownerName}
        peeks={peeks}
      >
        <p>Active</p>
      </ThreadStack>,
    );
    expect(
      screen.getByRole("button", { name: /Switch to Main/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Switch to Bob's fork/ }),
    ).toBeInTheDocument();
  });

  it("switches to a conversation when its peeking card is clicked", async () => {
    const selected = await new Promise<string>((resolve) => {
      render(
        <ThreadStack
          activeBranchId="main"
          onSelectBranch={resolve}
          ownerName={ownerName}
          peeks={peeks}
        >
          <p>Active</p>
        </ThreadStack>,
      );
      void userEvent.click(
        screen.getByRole("button", { name: /Switch to Bob's fork/ }),
      );
    });
    expect(selected).toBe("forkB");
  });
});
