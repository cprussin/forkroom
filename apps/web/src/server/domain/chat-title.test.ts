import { describe, expect, it } from "bun:test";
import { deriveChatTitle } from "./chat-title";

describe("deriveChatTitle", () => {
  it("uses a short message verbatim", () => {
    expect(deriveChatTitle("Plan a trip to Japan")).toBe(
      "Plan a trip to Japan",
    );
  });

  it("collapses whitespace and newlines to single spaces", () => {
    expect(deriveChatTitle("  hello\n\n  world  ")).toBe("hello world");
  });

  it("truncates a long message at a word boundary with an ellipsis", () => {
    const title = deriveChatTitle(
      "Can you help me understand how photosynthesis works in detail please",
    );
    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(49);
    expect(title).not.toContain("  ");
    // Cuts on a word boundary, so no partial trailing word before the ellipsis.
    expect(title).toBe("Can you help me understand how photosynthesis…");
  });

  it("falls back to a placeholder for blank content", () => {
    expect(deriveChatTitle("   \n  ")).toBe("New chat");
  });
});
