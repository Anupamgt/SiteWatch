import { NextRequest, NextResponse } from "next/server";
import { Prisma, SectionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSiteAccess, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { getFieldDefinitions } from "@/lib/fields";
import { getOrCreateSection } from "@/lib/reports";
import { buildSectionRowsSchema, type RowValues } from "@/lib/validation/rowSchema";
import { splitRowForPersistence, flattenRow } from "@/lib/rows";
import { withDefaultPercentComplete, withDefaultTotalManHours } from "@/lib/calculations";

function parseSectionType(raw: string): SectionType {
  if (raw === "WORK_PROGRAMME" || raw === "LABOUR_DEPLOYMENT") return raw;
  throw new HttpError(400, `Invalid section type: ${raw}`);
}

/**
 * PUT /api/reports/[reportId]/sections/[type]/draft
 * Full replace of the section's rows in one transaction: existing rows not
 * present in the payload are deleted, present ones are upserted. This is the
 * simplest correct autosave semantics. Only allowed while the section is
 * DRAFT — once SUBMITTED, only the reopen endpoint (admin) can unlock it.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string; type: string }> }
) {
  try {
    const { reportId, type: rawType } = await params;
    const type = parseSectionType(rawType);

    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new HttpError(404, "Report not found");

    await requireSiteAccess(report.siteId);

    const section = await getOrCreateSection(reportId, type);
    if (section.status !== "DRAFT") {
      throw new HttpError(409, "Section is submitted; ask an admin to reopen it before editing");
    }

    const site = await prisma.site.findUnique({ where: { id: report.siteId } });
    const standardShiftHours = Number(site?.standardShiftHours ?? 8);

    const fields = await getFieldDefinitions(report.siteId, type);
    const rowsSchema = buildSectionRowsSchema(fields, { mode: "draft" });

    const json = await req.json().catch(() => null);
    const bodyRows = json?.rows;
    const parsed = rowsSchema.safeParse(bodyRows);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid row data", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const incoming = parsed.data as (RowValues & { id?: string; sortOrder?: number })[];

    const existingIds =
      type === "WORK_PROGRAMME"
        ? (await prisma.taskRow.findMany({ where: { sectionId: section.id }, select: { id: true } })).map((r) => r.id)
        : (await prisma.labourRow.findMany({ where: { sectionId: section.id }, select: { id: true } })).map((r) => r.id);
    const existingIdSet = new Set(existingIds);

    // Security: an id in the payload must belong to THIS section. Without
    // this check, any authenticated engineer could overwrite an arbitrary
    // row in the database by guessing/supplying another section's row id.
    const foreignIds = incoming
      .filter((r) => r.id)
      .map((r) => r.id as string)
      .filter((id) => !existingIdSet.has(id));
    if (foreignIds.length > 0) {
      return NextResponse.json(
        { error: "One or more rows do not belong to this section", ids: foreignIds },
        { status: 400 }
      );
    }

    const incomingIds = new Set(incoming.filter((r) => r.id).map((r) => r.id as string));
    const idsToDelete = existingIds.filter((id) => !incomingIds.has(id));

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    incoming.forEach((row, index) => {
      const { systemData, customData } = splitRowForPersistence(row, fields);
      const sortOrder = row.sortOrder ?? index;

      if (type === "WORK_PROGRAMME") {
        const data = withDefaultPercentComplete(
          systemData as { targetQty?: number | null; achievedQty?: number | null; percentComplete?: number | null }
        );
        const payload = { ...data, sortOrder, custom: customData } as Prisma.TaskRowUncheckedUpdateInput;
        if (row.id) {
          // Belt and braces on top of the foreignIds check above: scope the
          // update to this section so a row id can never cross sections.
          ops.push(
            prisma.taskRow.updateMany({ where: { id: row.id, sectionId: section.id }, data: payload })
          );
        } else {
          ops.push(
            prisma.taskRow.create({
              data: { ...payload, sectionId: section.id } as Prisma.TaskRowUncheckedCreateInput,
            })
          );
        }
      } else {
        const data = withDefaultTotalManHours(
          systemData as { actualPresent?: number | null; totalManHours?: number | null },
          standardShiftHours
        );
        const payload = { ...data, sortOrder, custom: customData } as Prisma.LabourRowUncheckedUpdateInput;
        if (row.id) {
          ops.push(
            prisma.labourRow.updateMany({ where: { id: row.id, sectionId: section.id }, data: payload })
          );
        } else {
          ops.push(
            prisma.labourRow.create({
              data: { ...payload, sectionId: section.id } as Prisma.LabourRowUncheckedCreateInput,
            })
          );
        }
      }
    });

    if (idsToDelete.length > 0) {
      ops.push(
        type === "WORK_PROGRAMME"
          ? prisma.taskRow.deleteMany({ where: { id: { in: idsToDelete } } })
          : prisma.labourRow.deleteMany({ where: { id: { in: idsToDelete } } })
      );
    }

    ops.push(
      prisma.reportSection.update({
        where: { id: section.id },
        data: { lastSavedAt: new Date() },
      })
    );

    await prisma.$transaction(ops);

    const savedRows =
      type === "WORK_PROGRAMME"
        ? await prisma.taskRow.findMany({ where: { sectionId: section.id }, orderBy: { sortOrder: "asc" } })
        : await prisma.labourRow.findMany({ where: { sectionId: section.id }, orderBy: { sortOrder: "asc" } });

    return NextResponse.json({
      section: { ...section, lastSavedAt: new Date() },
      rows: savedRows.map((r) => flattenRow(r, fields)),
    });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
