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
        explicitForkRequested: false,
        membership: NON_MEMBER,
        ownsSelectedBranch: false,
      }),
    ).toStrictEqual({ denial: SubmissionDenialReason.NotMember });
  });

  it("appends when a member owns the selected branch", () => {
    expect(
      outcomeOf({
        explicitForkRequested: false,
        membership: Role.Creator,
        ownsSelectedBranch: true,
      }),
    ).toStrictEqual({ mode: SubmissionOutcome.Append });
  });

  it("forks when a member submits on a branch they do not own", () => {
    expect(
      outcomeOf({
        explicitForkRequested: false,
        membership: Role.Participant,
        ownsSelectedBranch: false,
      }),
    ).toStrictEqual({ mode: SubmissionOutcome.Fork });
  });

  it("forks from an owned branch when an explicit fork point is named", () => {
    expect(
      outcomeOf({
        explicitForkRequested: true,
        membership: Role.Creator,
        ownsSelectedBranch: true,
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
    expect(retryReason({ membership: NON_MEMBER, ownsBranch: false })).toBe(
      RetryDenialReason.NotMember,
    );
  });

  it("lets any member retry on a branch they own", () => {
    expect(retryReason({ membership: Role.Creator, ownsBranch: true })).toBe(
      "ok",
    );
    expect(
      retryReason({ membership: Role.Participant, ownsBranch: true }),
    ).toBe("ok");
  });

  it("forbids retrying a generation on a branch the member does not own", () => {
    expect(retryReason({ membership: Role.Creator, ownsBranch: false })).toBe(
      RetryDenialReason.Forbidden,
    );
    expect(
      retryReason({ membership: Role.Participant, ownsBranch: false }),
    ).toBe(RetryDenialReason.Forbidden);
  });
});
