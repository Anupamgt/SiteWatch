/**
 * Login rate limiter — Redis when configured, otherwise in-memory.
 *
 * ARCHITECTURE: 5 failures per (email + IP) per 15 minutes.
 * Redis path is shared across Vercel instances; memory path is single-process only.
 */
import { getRedis } from "@/lib/redis";

const WINDOW_MS = 15 * 60 * 1000;
const WINDOW_SEC = Math.ceil(WINDOW_MS / 1000);
const MAX_ATTEMPTS = 5;

type Bucket = { failures: number[] };
const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket, now: number) {
  bucket.failures = bucket.failures.filter((t) => now - t < WINDOW_MS);
}

function memoryAllowed(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket) return true;
  prune(bucket, now);
  return bucket.failures.length < MAX_ATTEMPTS;
}

function memoryFail(key: string) {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { failures: [] };
  prune(bucket, now);
  bucket.failures.push(now);
  buckets.set(key, bucket);
}

function memorySuccess(key: string) {
  buckets.delete(key);
}

function redisKey(key: string) {
  return `sitewatch:loginrl:${key}`;
}

/** Returns false if the key has already hit the attempt ceiling. */
export async function checkLoginRateLimit(key: string): Promise<boolean> {
  const client = getRedis();
  if (!client) return memoryAllowed(key);
  try {
    const count = await client.llen(redisKey(key));
    return count < MAX_ATTEMPTS;
  } catch (err) {
    console.error("[rateLimit] check failed, allowing request", err);
    return true;
  }
}

export async function recordLoginFailure(key: string): Promise<void> {
  const client = getRedis();
  if (!client) {
    memoryFail(key);
    return;
  }
  try {
    const k = redisKey(key);
    const pipe = client.pipeline();
    pipe.rpush(k, String(Date.now()));
    pipe.expire(k, WINDOW_SEC);
    await pipe.exec();
    // Trim to window size (best-effort)
    const len = await client.llen(k);
    if (len > MAX_ATTEMPTS + 2) {
      await client.ltrim(k, -MAX_ATTEMPTS, -1);
    }
  } catch (err) {
    console.error("[rateLimit] record failure failed", err);
    memoryFail(key);
  }
}

export async function recordLoginSuccess(key: string): Promise<void> {
  const client = getRedis();
  if (!client) {
    memorySuccess(key);
    return;
  }
  try {
    await client.del(redisKey(key));
  } catch (err) {
    console.error("[rateLimit] clear failed", err);
    memorySuccess(key);
  }
}
