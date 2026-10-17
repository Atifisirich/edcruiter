import { NextRequest } from 'next/server';

/**
 * In-memory fixed-window rate limiter, keyed by client IP + a route label.
 *
 * This is deliberately simple and has a real limitation: it is per-process, so
 * it resets on redeploy and does not share state across multiple container
 * instances. That is an acceptable trade for a single-instance pilot; the
 * moment this runs behind more than one instance, replace the Map below with
 * a shared store (Redis, Upstash) behind the same `checkRateLimit` signature
 * so call sites do not need to change.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Periodic sweep so long-running processes don't accumulate stale keys forever.
let lastSweep = Date.now();
function sweep() {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

function clientIp(req: NextRequest): string {
  // Trust only the first hop's header when running behind a single known
  // proxy (Cloud Run, a load balancer); a request cannot spoof its own
  // connecting IP, only the header, so this is best-effort identification for
  // abuse throttling, not an identity check.
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

export function checkRateLimit(
  req: NextRequest,
  label: string,
  options: { max: number; windowMs: number }
): { allowed: boolean; remaining: number; resetAt: number } {
  sweep();
  const key = `${label}:${clientIp(req)}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt < now) {
    const resetAt = now + options.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.max - 1, resetAt };
  }

  if (existing.count >= options.max) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: options.max - existing.count, resetAt: existing.resetAt };
}
