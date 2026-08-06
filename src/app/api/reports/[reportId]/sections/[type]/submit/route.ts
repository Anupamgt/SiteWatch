import { NextRequest, NextResponse } from "next/server";
import { SectionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSiteAccess, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { getFieldDefinitions } from "@/lib/fields";
import { getOrCreateSection } from "@/lib/reports";
import { buildSectionRowsSchema, type RowValues } from "@/lib/validation/rowSchema";
import { flattenRow } from "@/lib/rows";
import { persistSectionRows } from "@/lib/sectionPersist";

function parseSectionType(raw: string): SectionType {
  if (raw === "WORK_PROGRAMME" || raw === "LABOUR_DEPLOYMENT") return raw;
  throw new HttpError(400, `Invalid section type: ${raw}`);
}

/**
 * POST /api/reports/[reportId]/sections/[type]/submit
 *
 * Fast path: body may include `{ rows }` so save + validate + submit happen
 * in one request (avoids draft-then-submit double round trip).
 */
export async function POST(
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

    const json = await req.json().catch(() => ({}));
    const hasRows = Array.isArray(json?.rows);

    const [user, section, fields] = await Promise.all([
      requireSiteAccess(report.siteId),
      getOrCreateSection(reportId, type),
      getFieldDefinitions(report.siteId, type),
    ]);

    if (section.status === "SUBMITTED") {
      return NextResponse.json({ section, alreadySubmitted: true });
    }

    const standardShiftHours = Number(report.site.standardShiftHours ?? 8);
    const submitSchema = buildSectionRowsSchema(fields, { mode: "submit" });

    let flattened: (RowValues & { id?: string; sortOrder?: number })[];

    if (hasRows) {
      // Validate before writing so we fail fast without a wasted persist.
      const draftCheck = buildSectionRowsSchema(fields, { mode: "draft" }).safeParse(json.rows);
      if (!draftCheck.success) {
        return NextResponse.json(
          { error: "Invalid row data", details: draftCheck.error.issues },
          { status: 400 },
        );
      }
      const incoming = draftCheck.data as (RowValues & {
        id?: string;
        sortOrder?: number;
        ticketId?: string | null;
      })[];

      const submitCheck = submitSchema.safeParse(incoming);
      if (!submitCheck.success) {
        return NextResponse.json(
          {
            error: "One or more rows are missing required fields",
            details: submitCheck.error.issues,
          },
          { status: 400 },
        );
      }

      flattened = await persistSectionRows({
        section,
        type,
        siteId: report.siteId,
        fields,
        incoming,
        standardShiftHours,
      });
    } else {
      const rows =
        type === "WORK_PROGRAMME"
          ? await prisma.taskRow.findMany({
              where: { sectionId: section.id },
              orderBy: { sortOrder: "asc" },
            })
          : await prisma.labourRow.findMany({
              where: { sectionId: section.id },
              orderBy: { sortOrder: "asc" },
            });
      flattened = rows.map((r) => flattenRow(r, fields));
      const parsed = submitSchema.safeParse(flattened);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "One or more rows are missing required fields",
            details: parsed.error.issues,
          },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.reportSection.update({
      where: { id: section.id },
      data: {
        status: "SUBMITTED",
        submittedById: user.id,
        submittedAt: new Date(),
        lastSavedAt: new Date(),
      },
    });

    return NextResponse.json({
      section: updated,
      ...(hasRows ? { rows: flattened } : {}),
    });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
