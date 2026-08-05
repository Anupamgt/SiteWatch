import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteAccess, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { getSiteDashboard } from "@/lib/dashboard";
import { isValidDateParam, todayInAppTimezone } from "@/lib/dates";
import { subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/constants";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;
    await requireSiteAccess(siteId);
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new HttpError(404, "Site not found");

    const to = req.nextUrl.searchParams.get("to") || todayInAppTimezone();
    const from =
      req.nextUrl.searchParams.get("from") ||
      formatInTimeZone(subDays(new Date(), 6), APP_TIMEZONE, "yyyy-MM-dd");

    if (!isValidDateParam(from) || !isValidDateParam(to)) {
      throw new HttpError(400, "Invalid from/to date");
    }

    const dashboard = await getSiteDashboard(siteId, from, to);
    return NextResponse.json({ site, dashboard });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
