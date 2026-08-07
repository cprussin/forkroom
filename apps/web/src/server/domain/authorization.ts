import type { Result } from "@cprussin/option-result";
import { Err, Ok } from "@cprussin/option-result";
import type { SubmissionOutcome } from "./branching";
import { appendVsFork } from "./branching";
import { Role } from "./roles";

/**
 * Server-side authorization for chat capabilities, encoding the PRD's
 * authorization matrix (§11). Every route and worker path derives its decisions
 * from these functions; client-side controls are never authorization.
 *
 * A member's role is passed as `Role | undefined`, where `undefined` means "not
 * a member of this chat" — the only source of read/write denial that isn't
 * role-specific.
 */

export enum SubmissionDenialReason {
  NotMember = 0,
}

export const SubmissionDenial = {
  NotMember: () => ({ reason: SubmissionDenialReason.NotMember as const }),
};

export type SubmissionDenial = ReturnType<
  (typeof SubmissionDenial)[keyof typeof SubmissionDenial]
>;

export enum RetryDenialReason {
  NotMember = 0,
  Forbidden = 1,
}

export const RetryDenial = {
  Forbidden: () => ({ reason: RetryDenialReason.Forbidden as const }),
  NotMember: () => ({ reason: RetryDenialReason.NotMember as const }),
};

export type RetryDenial = ReturnType<
  (typeof RetryDenial)[keyof typeof RetryDenial]
>;

export type SubmissionInput = {
  membership: Role | undefined;
  ownsSelectedBranch: boolean;
  explicitForkRequested: boolean;
};

/**
 * Decide whether a submission is allowed and, if so, whether it appends or
 * forks. `Ok` carries `SubmissionOutcome.Append` or `SubmissionOutcome.Fork`;
 * `Err` marks a non-member, the only role-independent denial.
 */
export const authorizeSubmission = (
  input: SubmissionInput,
): Result<SubmissionOutcome, SubmissionDenial> => {
  if (input.membership === undefined) {
    return Err(SubmissionDenial.NotMember());
  } else {
    return Ok(
      appendVsFork({
        explicitForkRequested: input.explicitForkRequested,
        ownsSelectedBranch: input.ownsSelectedBranch,
      }),
    );
  }
};

export type RetryInput = {
  membership: Role | undefined;
  ownsBranch: boolean;
};

/**
 * Decide whether a user may retry a failed generation: any member, only on a
 * branch they own (the creator owns main).
 */
export const authorizeRetry = (
  input: RetryInput,
): Result<true, RetryDenial> => {
  if (input.membership === undefined) {
    return Err(RetryDenial.NotMember());
  } else {
    return input.ownsBranch ? Ok(true) : Err(RetryDenial.Forbidden());
  }
};

/** A user may read a chat and its branches iff they are a member. */
export const canReadChat = (membership: Role | undefined): boolean =>
  membership !== undefined;

/** Only the creator may create or revoke invitations. */
export const canManageInvites = (membership: Role | undefined): boolean =>
  membership === Role.Creator;

/** Any member may view the accepted-member list. */
export const canViewMembers = (membership: Role | undefined): boolean =>
  membership !== undefined;
