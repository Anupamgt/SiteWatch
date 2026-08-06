import { getRedis, isRedisConfigured } from "@/lib/redis";

/** Process-local fallback when Redis is not configured. */
const memory = new Map<string, { value: string; expiresAt: number | null }>();

const PREFIX = "sitewatch:";

function fullKey(key: string) {
  return `${PREFIX}${key}`;
}

function memoryGet(key: string): string | null {
  const row = memory.get(key);
  if (!row) return null;
  if (row.expiresAt != null && Date.now() > row.expiresAt) {
    memory.delete(key);
    return null;
  }
  return row.value;
}

function memorySet(key: string, value: string, ttlSeconds?: number) {
  memory.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const k = fullKey(key);
  const client = getRedis();
  try {
    if (client) {
      const value = await client.get<string | T>(k);
      if (value == null) return null;
      if (typeof value === "string") {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      }
      return value as T;
    }
    const raw = memoryGet(k);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error("[cache] get failed", key, err);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  const k = fullKey(key);
  const serialized = JSON.stringify(value);
  const client = getRedis();
  try {
    if (client) {
      if (ttlSeconds > 0) {
        await client.set(k, serialized, { ex: ttlSeconds });
      } else {
        await client.set(k, serialized);
      }
      return;
    }
    memorySet(k, serialized, ttlSeconds > 0 ? ttlSeconds : undefined);
  } catch (err) {
    console.error("[cache] set failed", key, err);
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const full = keys.map(fullKey);
  const client = getRedis();
  try {
    if (client) {
      await client.del(...full);
      return;
    }
    for (const k of full) memory.delete(k);
  } catch (err) {
    console.error("[cache] del failed", keys, err);
  }
}

/** Delete every key matching a prefix (best-effort; memory fallback is exact-prefix). */
export async function cacheDelByPrefix(prefix: string): Promise<void> {
  const client = getRedis();
  const patterned = fullKey(prefix);
  try {
    if (client) {
      // Upstash scan — avoid circular inference on cursor/result
      let cursor: number | string = 0;
      for (;;) {
        const scanned = (await client.scan(cursor, {
          match: `${patterned}*`,
          count: 100,
        })) as [number | string, string[]];
        const keys = scanned[1];
        cursor = scanned[0];
        if (keys.length) await client.del(...keys);
        if (cursor === 0 || cursor === "0") break;
      }
      return;
    }
    for (const k of [...memory.keys()]) {
      if (k.startsWith(patterned)) memory.delete(k);
    }
  } catch (err) {
    console.error("[cache] delByPrefix failed", prefix, err);
  }
}

/**
 * Cache-aside helper. `ttlSeconds` default 5 minutes.
 * Works with or without Redis (memory fallback).
 */
export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds = 300
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit != null) return hit;
  const value = await loader();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

export function cacheBackend(): "redis" | "memory" {
  return isRedisConfigured() ? "redis" : "memory";
}

/** Field-definition cache keys / invalidation. */
export function fieldDefsCacheKey(siteId: string, sectionType: string) {
  return `fields:${siteId}:${sectionType}`;
}

export async function invalidateFieldDefsCache(siteId: string) {
  await cacheDelByPrefix(`fields:${siteId}:`);
  // Global template changes affect every site — clear all field caches.
  await cacheDelByPrefix("fields:");
}
