import { NextRequest, NextResponse } from "next/server";
import { SectionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSiteAccess, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { loadSectionData } from "@/lib/reports";

function parseSectionType(raw: string): SectionType {
  if (raw === "WORK_PROGRAMME" || raw === "LABOUR_DEPLOYMENT") return raw;
  throw new HttpError(400, `Invalid section type: ${raw}`);
}

/**
 * GET /api/reports/[reportId]/sections/[type]
 * Returns the resolved field definitions plus the section's rows, flattened
 * to { [fieldKey]: value } so the dynamic form can render directly from it.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string; type: string }> }
) {
  try {
    const { reportId, type: rawType } = await params;
    const type = parseSectionType(rawType);

    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new HttpError(404, "Report not found");

    await requireSiteAccess(report.siteId);

    const { section, fields, rows } = await loadSectionData(report.siteId, reportId, type);

    return NextResponse.json({ report, section, fields, rows });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
