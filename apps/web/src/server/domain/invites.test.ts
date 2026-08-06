import { describe, expect, it } from "bun:test";
import type { InviteState } from "./invites";
import {
  assessInvite,
  defaultInviteExpiry,
  generateInviteToken,
  hashInviteToken,
  InviteRejectionReason,
} from "./invites";

const NOW = new Date("2026-08-06T00:00:00.000Z");

const reasonOf = (state: InviteState, now = NOW) =>
  assessInvite(state, now).match({
    Err: (rejection) => rejection.reason as InviteRejectionReason | "ok",
    Ok: () => "ok" as const,
  });

const OPEN: InviteState = {
  expiresAt: undefined,
  maxUses: undefined,
  revokedAt: undefined,
  useCount: 0,
};

describe("hashInviteToken", () => {
  it("is deterministic for the same token", () => {
    expect(hashInviteToken("abc")).toBe(hashInviteToken("abc"));
  });

  it("differs for different tokens and never returns the raw token", () => {
    const hash = hashInviteToken("abc");
    expect(hash).not.toBe(hashInviteToken("abd"));
    expect(hash).not.toBe("abc");
    expect(hash).toHaveLength(64);
  });
});

describe("generateInviteToken", () => {
  it("encodes the injected entropy as base64url", () => {
    const token = generateInviteToken((size) => Buffer.alloc(size, 0));
    expect(token).toBe("A".repeat(43));
    expect(token).not.toMatch(/[+/=]/);
  });
});

describe("assessInvite", () => {
  it("accepts an open, unrestricted invite", () => {
    expect(reasonOf(OPEN)).toBe("ok");
  });

  it("rejects a revoked invite before anything else", () => {
    expect(
      reasonOf({
        ...OPEN,
        expiresAt: new Date(NOW.getTime() - 1),
        revokedAt: NOW,
      }),
    ).toBe(InviteRejectionReason.Revoked);
  });

  it("rejects an expired invite", () => {
    expect(reasonOf({ ...OPEN, expiresAt: NOW })).toBe(
      InviteRejectionReason.Expired,
    );
  });

  it("accepts an invite whose expiry is still in the future", () => {
    expect(
      reasonOf({ ...OPEN, expiresAt: new Date(NOW.getTime() + 1000) }),
    ).toBe("ok");
  });

  it("rejects an exhausted invite", () => {
    expect(reasonOf({ ...OPEN, maxUses: 3, useCount: 3 })).toBe(
      InviteRejectionReason.Exhausted,
    );
  });

  it("accepts an invite with uses remaining", () => {
    expect(reasonOf({ ...OPEN, maxUses: 3, useCount: 2 })).toBe("ok");
  });
});

describe("defaultInviteExpiry", () => {
  it("is seven days after now", () => {
    expect(defaultInviteExpiry(NOW).toISOString()).toBe(
      "2026-08-13T00:00:00.000Z",
    );
  });
});
