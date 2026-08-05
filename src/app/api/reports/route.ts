import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSiteAccess, errorResponseBody } from "@/lib/auth-guards";
import { getOrCreateReport } from "@/lib/reports";
import { isValidDateParam } from "@/lib/dates";

const bodySchema = z.object({
  siteId: z.string().min(1),
  reportDate: z.string().refine(isValidDateParam, "reportDate must be YYYY-MM-DD"),
});

/**
 * POST /api/reports — idempotent upsert on (siteId, reportDate). Seeds the
 * header snapshot from Site on first creation. Engineers may only do this
 * for a site they belong to; admins may do it for any site.
 */
export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { siteId, reportDate } = parsed.data;
    const user = await requireSiteAccess(siteId);
    const report = await getOrCreateReport(siteId, reportDate, user.id);
    return NextResponse.json(report, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
