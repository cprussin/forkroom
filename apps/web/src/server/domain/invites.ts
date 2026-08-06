import { createHash, randomBytes as cryptoRandomBytes } from "node:crypto";
import type { Result } from "@cprussin/option-result";
import { Err, Ok } from "@cprussin/option-result";

/** Seven days, the MVP default invitation lifetime. */
export const DEFAULT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export enum InviteRejectionReason {
  Revoked = 0,
  Expired = 1,
  Exhausted = 2,
}

export const InviteRejection = {
  Exhausted: () => ({ reason: InviteRejectionReason.Exhausted as const }),
  Expired: () => ({ reason: InviteRejectionReason.Expired as const }),
  Revoked: () => ({ reason: InviteRejectionReason.Revoked as const }),
};

export type InviteRejection = ReturnType<
  (typeof InviteRejection)[keyof typeof InviteRejection]
>;

export type InviteState = {
  expiresAt: Date | undefined;
  revokedAt: Date | undefined;
  maxUses: number | undefined;
  useCount: number;
};

/**
 * Generate a fresh invitation token. Returns the raw token (shown to the
 * creator exactly once) — only its hash is ever stored.
 *
 * @param randomBytes - Entropy source; defaults to `crypto.randomBytes` and is
 *   overridable in tests.
 */
export const generateInviteToken = (
  randomBytes: (size: number) => Buffer = cryptoRandomBytes,
): string => randomBytes(32).toString("base64url");

/**
 * Hash a raw invitation token for storage and lookup. SHA-256 is a one-way
 * function, so a leaked database never yields usable tokens; lookups hash the
 * presented token and match on `token_hash`, which is constant-time at the
 * index level and never compares raw secrets.
 */
export const hashInviteToken = (rawToken: string): string =>
  createHash("sha256").update(rawToken).digest("hex");

/**
 * Decide whether an invitation is currently acceptable. Revocation is checked
 * before expiry before exhaustion so the most decisive reason is reported.
 */
export const assessInvite = (
  state: InviteState,
  now: Date,
): Result<true, InviteRejection> => {
  if (state.revokedAt !== undefined) {
    return Err(InviteRejection.Revoked());
  } else if (
    state.expiresAt !== undefined &&
    now.getTime() >= state.expiresAt.getTime()
  ) {
    return Err(InviteRejection.Expired());
  } else if (state.maxUses !== undefined && state.useCount >= state.maxUses) {
    return Err(InviteRejection.Exhausted());
  } else {
    return Ok(true);
  }
};

/** The default expiry timestamp for a newly created invitation. */
export const defaultInviteExpiry = (now: Date): Date =>
  new Date(now.getTime() + DEFAULT_INVITE_TTL_MS);
