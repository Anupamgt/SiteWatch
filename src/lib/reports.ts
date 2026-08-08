import type { SectionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDateOnly, dayOfWeekFromDateOnly } from "@/lib/dates";
import { HttpError } from "@/lib/auth-guards";
import { getFieldDefinitions } from "@/lib/fields";
import { flattenRow } from "@/lib/rows";
import { LABOUR_TYPES } from "@/lib/constants";

/**
 * Idempotent upsert on (siteId, reportDate). Header defaults are snapshotted
 * from Site at creation time only — an existing report keeps whatever header
 * values it already has (ARCHITECTURE.md §2.1: historical DPRs must not
 * silently pick up a later Site edit).
 */
export async function getOrCreateReport(
  siteId: string,
  reportDateStr: string,
  createdById?: string
) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new HttpError(404, "Site not found");

  const reportDate = parseDateOnly(reportDateStr);
  const dayOfWeek = dayOfWeekFromDateOnly(reportDateStr);

  const report = await prisma.report.upsert({
    where: { siteId_reportDate: { siteId, reportDate } },
    update: {},
    create: {
      siteId,
      reportDate,
      projectName: site.projectName,
      locationZone: site.locationZone,
      contractorClient: site.contractorClient,
      dayOfWeek,
      createdById,
    },
  });

  return report;
}

/** A ReportSection is created lazily the first time it is opened. */
export async function getOrCreateSection(reportId: string, type: SectionType) {
  return prisma.reportSection.upsert({
    where: { reportId_type: { reportId, type } },
    update: {},
    create: { reportId, type },
  });
}

/**
 * When an engineer first opens Labour Deployment on a DRAFT section with no
 * rows yet, seed one row per known labour type so they only enter Bus Number
 * (headcount on site) for each trade.
 */
async function ensureDefaultLabourRows(sectionId: string, status: string) {
  if (status !== "DRAFT") return;

  const existingCount = await prisma.labourRow.count({ where: { sectionId } });
  if (existingCount > 0) return;

  await prisma.labourRow.createMany({
    data: LABOUR_TYPES.map((labourCategory, sortOrder) => ({
      sectionId,
      sortOrder,
      labourCategory,
    })),
  });
}

/**
 * Loads (and lazily creates) a section plus its resolved field definitions
 * and flattened rows. Shared by the section GET API route and the engineer
 * section pages so both stay in lockstep with `getFieldDefinitions`.
 */
export async function loadSectionData(siteId: string, reportId: string, type: SectionType) {
  const section = await getOrCreateSection(reportId, type);
  const fields = await getFieldDefinitions(siteId, type);

  if (type === "LABOUR_DEPLOYMENT") {
    await ensureDefaultLabourRows(section.id, section.status);
  }

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

  return {
    section,
    fields,
    rows: rows.map((r) => flattenRow(r, fields)),
  };
}

/** Section status for a report without creating anything — used by summary
 * views (site home, sites list) that must not have the side effect of
 * lazily creating a section just by being displayed. */
export async function getSectionStatusIfExists(reportId: string, type: SectionType) {
  const section = await prisma.reportSection.findUnique({
    where: { reportId_type: { reportId, type } },
    select: { status: true, lastSavedAt: true, submittedAt: true },
  });
  return section;
}
