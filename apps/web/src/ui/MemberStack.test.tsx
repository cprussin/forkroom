import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MemberEntity } from "../contracts/chat-entities";
import { MemberStack } from "./MemberStack";

const member = (id: string, name: string): MemberEntity => ({
  avatarUrl: `https://example.test/${id}.png`,
  displayName: name,
  role: "participant",
  userId: id,
});

describe("MemberStack", () => {
  it("labels the count in the plural for multiple members", () => {
    render(
      <MemberStack members={[member("a", "Alice"), member("b", "Bob")]} />,
    );
    expect(screen.getByText("2 members")).toBeInTheDocument();
  });

  it("labels the count in the singular for a lone member", () => {
    render(<MemberStack members={[member("a", "Alice")]} />);
    expect(screen.getByText("1 member")).toBeInTheDocument();
  });

  it("caps the avatar stack while still counting every member", () => {
    const members = Array.from({ length: 7 }, (_, index) =>
      member(`u${index.toString()}`, `Member ${index.toString()}`),
    );
    render(<MemberStack members={members} />);
    expect(screen.getByText("7 members")).toBeInTheDocument();
    // The collapsed stack shows only the first five avatars (identified by
    // their fallback initials); the sixth and seventh are dropped. The full
    // roster only appears in the popover, which is closed here.
    expect(screen.getByText("M4")).toBeInTheDocument();
    expect(screen.queryByText("M5")).not.toBeInTheDocument();
    expect(screen.queryByText("M6")).not.toBeInTheDocument();
  });

  it("reveals every member's name on hover", async () => {
    const user = userEvent.setup();
    render(
      <MemberStack members={[member("a", "Alice"), member("b", "Bob")]} />,
    );
    await user.hover(screen.getByRole("button", { name: /members/ }));
    const list = await screen.findByRole("list");
    expect(list).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });
});
