import type { Result } from "@cprussin/option-result";
import { Err, Ok } from "@cprussin/option-result";
import { appendVsFork, SubmissionOutcome } from "./branching";
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
  CreatorOffMain = 1,
}

export const SubmissionDenial = {
  CreatorOffMain: () => ({
    reason: SubmissionDenialReason.CreatorOffMain as const,
  }),
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
  selectedIsMain: boolean;
};

/**
 * Decide whether a submission is allowed and, if so, whether it appends or
 * forks. `Ok` carries `SubmissionOutcome.Append` or `SubmissionOutcome.Fork`;
 * `Err` distinguishes a non-member from a creator composing off the main
 * branch (which the MVP forbids).
 */
export const authorizeSubmission = (
  input: SubmissionInput,
): Result<SubmissionOutcome, SubmissionDenial> => {
  if (input.membership === undefined) {
    return Err(SubmissionDenial.NotMember());
  } else {
    const outcome = appendVsFork({
      isCreator: input.membership === Role.Creator,
      ownsSelectedBranch: input.ownsSelectedBranch,
      selectedIsMain: input.selectedIsMain,
    });
    switch (outcome) {
      case SubmissionOutcome.Append: {
        return Ok(SubmissionOutcome.Append);
      }
      case SubmissionOutcome.Fork: {
        return Ok(SubmissionOutcome.Fork);
      }
      case SubmissionOutcome.CreatorMustReturnToMain: {
        return Err(SubmissionDenial.CreatorOffMain());
      }
    }
  }
};

export type RetryInput = {
  membership: Role | undefined;
  isMainBranch: boolean;
  ownsBranch: boolean;
};

/**
 * Decide whether a user may retry a failed generation: the creator only on the
 * main branch, a participant only on a branch they own.
 */
export const authorizeRetry = (
  input: RetryInput,
): Result<true, RetryDenial> => {
  if (input.membership === undefined) {
    return Err(RetryDenial.NotMember());
  } else if (input.membership === Role.Creator) {
    return input.isMainBranch ? Ok(true) : Err(RetryDenial.Forbidden());
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
