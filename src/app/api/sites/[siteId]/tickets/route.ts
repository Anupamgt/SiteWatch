import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteAccess, errorResponseBody } from "@/lib/auth-guards";

/** Open (non-closed, non-deleted) tickets for a site — used by DPR task linking. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> },
) {
  try {
    const { siteId } = await params;
    await requireSiteAccess(siteId);
    const includeClosed = req.nextUrl.searchParams.get("includeClosed") === "1";

    const tickets = await prisma.ticket.findMany({
      where: {
        siteId,
        deletedAt: null,
        ...(includeClosed ? {} : { status: { not: "CLOSED" } }),
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ tickets });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
