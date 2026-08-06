import { NextResponse } from "next/server";
import { requireAdmin, errorResponseBody } from "@/lib/auth-guards";
import { cacheBackend, cacheGet, cacheSet } from "@/lib/cache";
import { isRedisConfigured } from "@/lib/redis";

/** Admin health check for Redis / cache backend. */
export async function GET() {
  try {
    await requireAdmin();
    const backend = cacheBackend();
    const probeKey = `health:ping`;
    const token = `ok-${Date.now()}`;
    await cacheSet(probeKey, { token }, 30);
    const roundtrip = await cacheGet<{ token: string }>(probeKey);
    return NextResponse.json({
      redisConfigured: isRedisConfigured(),
      backend,
      roundtripOk: roundtrip?.token === token,
    });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
