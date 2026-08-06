/**
 * Domain errors returned by service functions as the `Err` side of a `Result`.
 * Each carries a stable machine `code`, an HTTP `status`, and a human `title`,
 * so a route handler renders a consistent problem-detail response without a
 * per-route mapping (`docs/guidelines/OPTION_RESULT.md`). None of these expose
 * provider secrets or raw internal errors.
 */
export type DomainError = {
  code: string;
  status: number;
  title: string;
};

const make =
  (code: string, status: number, title: string) => (): DomainError => ({
    code,
    status,
    title,
  });

export const DomainErrors = {
  branchNotFound: make("branch_not_found", 404, "Branch not found"),
  chatNotFound: make("chat_not_found", 404, "Chat not found"),
  creatorOffMain: make(
    "creator_must_use_main",
    409,
    "Return to the main branch to compose",
  ),
  forbidden: make("forbidden", 403, "Not permitted"),
  generationInProgress: make(
    "generation_in_progress",
    409,
    "A response is already generating on this branch",
  ),
  inviteExhausted: make("invite_exhausted", 410, "Invitation is used up"),
  inviteExpired: make("invite_expired", 410, "Invitation has expired"),
  inviteInvalid: make("invite_invalid", 404, "Invitation not found"),
  inviteRevoked: make("invite_revoked", 410, "Invitation was revoked"),
  notFound: make("not_found", 404, "Not found"),
  notMember: make("not_member", 403, "You are not a member of this chat"),
  notRetryable: make("not_retryable", 409, "This generation cannot be retried"),
  promptTooLong: make(
    "prompt_too_long",
    422,
    "Prompt exceeds the maximum size",
  ),
  rateLimited: make("rate_limited", 429, "Too many requests"),
  staleTip: make(
    "branch_tip_changed",
    409,
    "The branch changed since you loaded it; review and resubmit",
  ),
  unauthenticated: make("unauthenticated", 401, "Sign in required"),
  validationFailed: make("validation_failed", 422, "Invalid request"),
} as const;
