import { NextRequest, NextResponse } from "next/server";
import { SectionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSiteAccess, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { getFieldDefinitions } from "@/lib/fields";
import { getOrCreateSection } from "@/lib/reports";
import { buildSectionRowsSchema } from "@/lib/validation/rowSchema";
import { flattenRow } from "@/lib/rows";

function parseSectionType(raw: string): SectionType {
  if (raw === "WORK_PROGRAMME" || raw === "LABOUR_DEPLOYMENT") return raw;
  throw new HttpError(400, `Invalid section type: ${raw}`);
}

/**
 * POST /api/reports/[reportId]/sections/[type]/submit
 * Validates every existing row against the section's required fields, then
 * flips the section DRAFT -> SUBMITTED. Idempotent: submitting an already
 * SUBMITTED section just returns its current state.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string; type: string }> }
) {
  try {
    const { reportId, type: rawType } = await params;
    const type = parseSectionType(rawType);

    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new HttpError(404, "Report not found");

    const user = await requireSiteAccess(report.siteId);

    const section = await getOrCreateSection(reportId, type);
    if (section.status === "SUBMITTED") {
      return NextResponse.json({ section, alreadySubmitted: true });
    }

    const fields = await getFieldDefinitions(report.siteId, type);

    const rows =
      type === "WORK_PROGRAMME"
        ? await prisma.taskRow.findMany({ where: { sectionId: section.id }, orderBy: { sortOrder: "asc" } })
        : await prisma.labourRow.findMany({ where: { sectionId: section.id }, orderBy: { sortOrder: "asc" } });

    const flattened = rows.map((r) => flattenRow(r, fields));
    const schema = buildSectionRowsSchema(fields, { mode: "submit" });
    const parsed = schema.safeParse(flattened);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "One or more rows are missing required fields",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.reportSection.update({
      where: { id: section.id },
      data: {
        status: "SUBMITTED",
        submittedById: user.id,
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({ section: updated });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
