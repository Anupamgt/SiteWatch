/**
 * In-memory sliding-window rate limiter for login attempts.
 *
 * ARCHITECTURE.md / REMAINING_WORK.md §16: 5 attempts per (email + IP) per
 * 15 minutes, applied inside the Credentials `authorize` callback.
 *
 * CAVEAT: this state lives in the Node process's memory. It works for a
 * single-instance deployment (e.g. one Cloud Run instance, `next start`
 * locally) but resets on redeploy/restart and is NOT shared across
 * instances. A multi-instance production deployment needs a shared store
 * (Redis, e.g. `@upstash/ratelimit`) instead — see README.md.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Bucket = { failures: number[]; };

const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket, now: number) {
  bucket.failures = bucket.failures.filter((t) => now - t < WINDOW_MS);
}

/** Returns false if the key has already hit the attempt ceiling. Does not
 * itself record an attempt — call recordLoginFailure/recordLoginSuccess. */
export function checkLoginRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket) return true;
  prune(bucket, now);
  return bucket.failures.length < MAX_ATTEMPTS;
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { failures: [] };
  prune(bucket, now);
  bucket.failures.push(now);
  buckets.set(key, bucket);
}

/** A successful login clears the window so a legitimate user who mistyped
 * their password a couple of times isn't punished afterwards. */
export function recordLoginSuccess(key: string): void {
  buckets.delete(key);
}
