/**
 * Redis client (Upstash REST — serverless-friendly on Vercel).
 *
 * When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are unset, helpers
 * fall back to an in-process Map so local/dev keeps working without Redis.
 */
import { Redis } from "@upstash/redis";

let redis: Redis | null | undefined;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  if (!isRedisConfigured()) {
    redis = null;
    return redis;
  }
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return redis;
}
