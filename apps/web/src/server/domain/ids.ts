import { uuidv7 } from "uuidv7";

/**
 * Mint a fresh time-ordered UUIDv7. Centralized so ID generation is one
 * injectable seam: callers that need determinism in a test pass their own
 * generator with this signature.
 */
export const newId = (): string => uuidv7();

export type IdGenerator = typeof newId;
