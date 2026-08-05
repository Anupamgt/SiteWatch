import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteAccess, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { reportHeaderSchema } from "@/lib/validation/adminSchemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        sections: true,
        approvedBy: { select: { id: true, name: true } },
        site: { select: { id: true, code: true, name: true } },
      },
    });
    if (!report) throw new HttpError(404, "Report not found");
    await requireSiteAccess(report.siteId);
    return NextResponse.json({ report });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const existing = await prisma.report.findUnique({ where: { id: reportId } });
    if (!existing) throw new HttpError(404, "Report not found");
    await requireSiteAccess(existing.siteId);

    const json = await req.json().catch(() => null);
    const parsed = reportHeaderSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;
    const report = await prisma.report.update({
      where: { id: reportId },
      data: {
        ...(data.siteEngineerName !== undefined ? { siteEngineerName: data.siteEngineerName } : {}),
        ...(data.siteSupervisorName !== undefined ? { siteSupervisorName: data.siteSupervisorName } : {}),
        ...(data.weatherCondition !== undefined ? { weatherCondition: data.weatherCondition } : {}),
        ...(data.locationZone !== undefined ? { locationZone: data.locationZone } : {}),
        ...(data.contractorClient !== undefined ? { contractorClient: data.contractorClient } : {}),
        ...(data.projectName !== undefined ? { projectName: data.projectName } : {}),
      },
    });
    return NextResponse.json({ report });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
