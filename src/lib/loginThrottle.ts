/**
 * Counts attempts against a name (an email address, say) rather than an IP, so a
 * guesser cannot dodge the limit by changing address. In memory, like
 * rateLimit.ts: one Cloud Run instance today, and the same Map-to-shared-store
 * swap applies the day there are several.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function live(key: string, now: number): Bucket | undefined {
  const b = buckets.get(key);
  if (b && b.resetAt < now) {
    buckets.delete(key);
    return undefined;
  }
  return b;
}

/** True once `key` has used up its `max` hits inside the window. Does not count. */
export function isBlocked(key: string, max: number): boolean {
  return (live(key, Date.now())?.count ?? 0) >= max;
}

/** Counts one hit. Returns false when this hit went over the limit. */
export function hit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = live(key, now);
  if (!b) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return max >= 1;
  }
  b.count += 1;
  return b.count <= max;
}

export function clear(key: string): void {
  buckets.delete(key);
}

export function resetAllForTests(): void {
  buckets.clear();
}
