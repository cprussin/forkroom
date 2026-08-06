import { describe, expect, it } from "bun:test";
import {
  authorizeRetry,
  authorizeSubmission,
  canManageInvites,
  canReadChat,
  canViewMembers,
  RetryDenialReason,
  SubmissionDenialReason,
} from "./authorization";
import { SubmissionOutcome } from "./branching";
import { Role } from "./roles";

const NON_MEMBER = undefined;

type OutcomeSummary =
  | { denial: SubmissionDenialReason }
  | { mode: SubmissionOutcome };

const outcomeOf = (
  input: Parameters<typeof authorizeSubmission>[0],
): OutcomeSummary =>
  authorizeSubmission(input).match<OutcomeSummary>({
    Err: (denial) => ({ denial: denial.reason }),
    Ok: (mode) => ({ mode }),
  });

describe("authorizeSubmission (authorization matrix §11)", () => {
  it("rejects non-members", () => {
    expect(
      outcomeOf({
        membership: NON_MEMBER,
        ownsSelectedBranch: false,
        selectedIsMain: true,
      }),
    ).toStrictEqual({ denial: SubmissionDenialReason.NotMember });
  });

  it("lets the creator append on main", () => {
    expect(
      outcomeOf({
        membership: Role.Creator,
        ownsSelectedBranch: true,
        selectedIsMain: true,
      }),
    ).toStrictEqual({ mode: SubmissionOutcome.Append });
  });

  it("blocks the creator from composing on a participant branch", () => {
    expect(
      outcomeOf({
        membership: Role.Creator,
        ownsSelectedBranch: false,
        selectedIsMain: false,
      }),
    ).toStrictEqual({ denial: SubmissionDenialReason.CreatorOffMain });
  });

  it("forks a participant submitting from main", () => {
    expect(
      outcomeOf({
        membership: Role.Participant,
        ownsSelectedBranch: false,
        selectedIsMain: true,
      }),
    ).toStrictEqual({ mode: SubmissionOutcome.Fork });
  });

  it("appends a participant continuing their own branch", () => {
    expect(
      outcomeOf({
        membership: Role.Participant,
        ownsSelectedBranch: true,
        selectedIsMain: false,
      }),
    ).toStrictEqual({ mode: SubmissionOutcome.Append });
  });

  it("forks a participant submitting from another user's branch", () => {
    expect(
      outcomeOf({
        membership: Role.Participant,
        ownsSelectedBranch: false,
        selectedIsMain: false,
      }),
    ).toStrictEqual({ mode: SubmissionOutcome.Fork });
  });
});

describe("read / invite / member capabilities (§11)", () => {
  it("permits reads for members only", () => {
    expect(canReadChat(Role.Creator)).toBe(true);
    expect(canReadChat(Role.Participant)).toBe(true);
    expect(canReadChat(NON_MEMBER)).toBe(false);
  });

  it("permits invite management for the creator only", () => {
    expect(canManageInvites(Role.Creator)).toBe(true);
    expect(canManageInvites(Role.Participant)).toBe(false);
    expect(canManageInvites(NON_MEMBER)).toBe(false);
  });

  it("permits viewing members for any member", () => {
    expect(canViewMembers(Role.Creator)).toBe(true);
    expect(canViewMembers(Role.Participant)).toBe(true);
    expect(canViewMembers(NON_MEMBER)).toBe(false);
  });
});

describe("authorizeRetry (§11)", () => {
  const retryReason = (input: Parameters<typeof authorizeRetry>[0]) =>
    authorizeRetry(input).match({
      Err: (denial) => denial.reason as RetryDenialReason | "ok",
      Ok: () => "ok" as const,
    });

  it("rejects non-members", () => {
    expect(
      retryReason({
        isMainBranch: true,
        membership: NON_MEMBER,
        ownsBranch: false,
      }),
    ).toBe(RetryDenialReason.NotMember);
  });

  it("lets the creator retry only on main", () => {
    expect(
      retryReason({
        isMainBranch: true,
        membership: Role.Creator,
        ownsBranch: true,
      }),
    ).toBe("ok");
    expect(
      retryReason({
        isMainBranch: false,
        membership: Role.Creator,
        ownsBranch: false,
      }),
    ).toBe(RetryDenialReason.Forbidden);
  });

  it("lets a participant retry only on a branch they own", () => {
    expect(
      retryReason({
        isMainBranch: false,
        membership: Role.Participant,
        ownsBranch: true,
      }),
    ).toBe("ok");
    expect(
      retryReason({
        isMainBranch: false,
        membership: Role.Participant,
        ownsBranch: false,
      }),
    ).toBe(RetryDenialReason.Forbidden);
  });
});
