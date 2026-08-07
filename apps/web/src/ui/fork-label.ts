/**
 * The label for a branch owner's fork — "Alice's fork" for a named member, and
 * "Your fork" for the current user, whose name renders as "You" (whose
 * possessive is "Your", not "You's").
 */
export const forkLabel = (ownerName: string): string =>
  ownerName === "You" ? "Your fork" : `${ownerName}'s fork`;
