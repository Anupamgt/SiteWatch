/**
 * Shared, database-backed sliding-window rate limiter for login attempts.
 *
 * ARCHITECTURE.md / REMAINING_WORK.md §16: 5 attempts per (email + IP) per
 * 15 minutes, applied inside the Credentials `authorize` callback.
 *
 * State lives in Postgres (the `LoginAttempt` table), NOT process memory, so
 * the limit is enforced consistently across every worker and instance. This is
 * what makes running the app on more than one process safe — the clustered
 * production server (`server.js`) and any multi-instance deployment all share
 * the same counters. The previous in-memory implementation reset on restart
 * and multiplied the effective ceiling by the number of workers.
 *
 * All functions fail open: if the datastore is briefly unavailable we would
 * rather let a legitimate user in than lock everyone out. A failed login still
 * requires a correct password, so failing open here does not bypass auth.
 */

import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/** Returns false if the key has already hit the attempt ceiling within the
 * window. Does not itself record an attempt — call
 * recordLoginFailure/recordLoginSuccess. */
export async function checkLoginRateLimit(key: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - WINDOW_MS);
    const failures = await prisma.loginAttempt.count({
      where: { key, createdAt: { gte: since } },
    });
    return failures < MAX_ATTEMPTS;
  } catch (err) {
    console.error("rateLimit.checkLoginRateLimit failed; failing open", err);
    return true;
  }
}

export async function recordLoginFailure(key: string): Promise<void> {
  try {
    await prisma.loginAttempt.create({ data: { key } });
    // Opportunistically prune stale rows for this key so the table stays small.
    const since = new Date(Date.now() - WINDOW_MS);
    await prisma.loginAttempt.deleteMany({
      where: { key, createdAt: { lt: since } },
    });
  } catch (err) {
    console.error("rateLimit.recordLoginFailure failed", err);
  }
}

/** A successful login clears the window so a legitimate user who mistyped
 * their password a couple of times isn't punished afterwards. */
export async function recordLoginSuccess(key: string): Promise<void> {
  try {
    await prisma.loginAttempt.deleteMany({ where: { key } });
  } catch (err) {
    console.error("rateLimit.recordLoginSuccess failed", err);
  }
}
