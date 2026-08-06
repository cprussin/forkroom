/**
 * A minimal fixed-window rate limiter kept in process memory. Adequate for the
 * MVP's abuse protection on auth, invites, prompts, and retries; on a
 * multi-instance deployment each instance limits independently (documented as a
 * known MVP limitation, swappable for a shared store later).
 */
const windows = new Map<string, { count: number; resetAt: number }>();

/**
 * Record a hit against `key` and report whether it is within `limit` per
 * `windowMs`. The clock is injectable for tests.
 */
export const rateLimit = (
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): boolean => {
  const existing = windows.get(key);
  if (existing === undefined || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  } else if (existing.count >= limit) {
    return false;
  } else {
    existing.count += 1;
    return true;
  }
};
