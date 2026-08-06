import { NextRequest, NextResponse } from "next/server";
import { SectionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSiteAccess, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { getFieldDefinitions } from "@/lib/fields";
import { getOrCreateSection } from "@/lib/reports";
import { buildSectionRowsSchema, type RowValues } from "@/lib/validation/rowSchema";
import { persistSectionRows } from "@/lib/sectionPersist";

function parseSectionType(raw: string): SectionType {
  if (raw === "WORK_PROGRAMME" || raw === "LABOUR_DEPLOYMENT") return raw;
  throw new HttpError(400, `Invalid section type: ${raw}`);
}

/**
 * PUT /api/reports/[reportId]/sections/[type]/draft
 * Full replace of the section's rows while DRAFT.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string; type: string }> },
) {
  try {
    const { reportId, type: rawType } = await params;
    const type = parseSectionType(rawType);

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        siteId: true,
        site: { select: { standardShiftHours: true } },
      },
    });
    if (!report) throw new HttpError(404, "Report not found");

    const [, section, fields] = await Promise.all([
      requireSiteAccess(report.siteId),
      getOrCreateSection(reportId, type),
      getFieldDefinitions(report.siteId, type),
    ]);

    if (section.status !== "DRAFT") {
      throw new HttpError(409, "Section is submitted; ask an admin to reopen it before editing");
    }

    const standardShiftHours = Number(report.site.standardShiftHours ?? 8);
    const rowsSchema = buildSectionRowsSchema(fields, { mode: "draft" });
    const json = await req.json().catch(() => null);
    const parsed = rowsSchema.safeParse(json?.rows);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid row data", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const incoming = parsed.data as (RowValues & { id?: string; sortOrder?: number })[];
    const rows = await persistSectionRows({
      section,
      type,
      siteId: report.siteId,
      fields,
      incoming,
      standardShiftHours,
    });

    return NextResponse.json({
      section: { ...section, lastSavedAt: new Date() },
      rows,
    });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
