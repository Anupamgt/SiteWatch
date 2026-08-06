import { Prisma, SectionType, type ReportSection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth-guards";
import type { ResolvedFieldDefinition } from "@/lib/fields";
import { splitRowForPersistence, flattenRow } from "@/lib/rows";
import { withDefaultPercentComplete, withDefaultTotalManHours } from "@/lib/calculations";
import type { RowValues } from "@/lib/validation/rowSchema";

type IncomingRow = RowValues & { id?: string; sortOrder?: number; ticketId?: string | null };

/**
 * Full-replace persist for a DRAFT section. Returns flattened saved rows.
 * Used by autosave and by submit (single round-trip).
 */
export async function persistSectionRows(opts: {
  section: ReportSection;
  type: SectionType;
  siteId: string;
  fields: ResolvedFieldDefinition[];
  incoming: IncomingRow[];
  standardShiftHours: number;
}): Promise<(RowValues & { id: string; sortOrder: number })[]> {
  const { section, type, siteId, fields, incoming, standardShiftHours } = opts;

  const existingIds =
    type === "WORK_PROGRAMME"
      ? (
          await prisma.taskRow.findMany({
            where: { sectionId: section.id },
            select: { id: true },
          })
        ).map((r) => r.id)
      : (
          await prisma.labourRow.findMany({
            where: { sectionId: section.id },
            select: { id: true },
          })
        ).map((r) => r.id);

  const existingIdSet = new Set(existingIds);
  const foreignIds = incoming
    .filter((r) => r.id)
    .map((r) => r.id as string)
    .filter((id) => !existingIdSet.has(id));
  if (foreignIds.length > 0) {
    throw new HttpError(400, "One or more rows do not belong to this section");
  }

  const incomingIds = new Set(incoming.filter((r) => r.id).map((r) => r.id as string));
  const idsToDelete = existingIds.filter((id) => !incomingIds.has(id));

  if (type === "WORK_PROGRAMME") {
    const ticketIds = [
      ...new Set(
        incoming
          .map((r) => r.ticketId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (ticketIds.length > 0) {
      const valid = await prisma.ticket.findMany({
        where: { id: { in: ticketIds }, siteId, deletedAt: null },
        select: { id: true },
      });
      if (valid.length !== ticketIds.length) {
        throw new HttpError(400, "Linked ticket is invalid for this site");
      }
    }
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  for (let index = 0; index < incoming.length; index++) {
    const row = incoming[index];
    const { systemData, customData } = splitRowForPersistence(row, fields);
    const sortOrder = row.sortOrder ?? index;

    if (type === "WORK_PROGRAMME") {
      const data = withDefaultPercentComplete(
        systemData as {
          targetQty?: number | null;
          achievedQty?: number | null;
          percentComplete?: number | null;
        },
      );
      const ticketId = "ticketId" in row ? row.ticketId || null : undefined;
      const payload = {
        ...data,
        sortOrder,
        custom: customData,
        ...(ticketId !== undefined ? { ticketId } : {}),
      } as Prisma.TaskRowUncheckedUpdateInput;
      if (row.id) {
        ops.push(
          prisma.taskRow.updateMany({
            where: { id: row.id, sectionId: section.id },
            data: payload,
          }),
        );
      } else {
        ops.push(
          prisma.taskRow.create({
            data: { ...payload, sectionId: section.id } as Prisma.TaskRowUncheckedCreateInput,
          }),
        );
      }
    } else {
      const data = withDefaultTotalManHours(
        systemData as { actualPresent?: number | null; totalManHours?: number | null },
        standardShiftHours,
      );
      const payload = {
        ...data,
        sortOrder,
        custom: customData,
      } as Prisma.LabourRowUncheckedUpdateInput;
      if (row.id) {
        ops.push(
          prisma.labourRow.updateMany({
            where: { id: row.id, sectionId: section.id },
            data: payload,
          }),
        );
      } else {
        ops.push(
          prisma.labourRow.create({
            data: { ...payload, sectionId: section.id } as Prisma.LabourRowUncheckedCreateInput,
          }),
        );
      }
    }
  }

  if (idsToDelete.length > 0) {
    ops.push(
      type === "WORK_PROGRAMME"
        ? prisma.taskRow.deleteMany({ where: { id: { in: idsToDelete } } })
        : prisma.labourRow.deleteMany({ where: { id: { in: idsToDelete } } }),
    );
  }

  ops.push(
    prisma.reportSection.update({
      where: { id: section.id },
      data: { lastSavedAt: new Date() },
    }),
  );

  await prisma.$transaction(ops);

  const savedRows =
    type === "WORK_PROGRAMME"
      ? await prisma.taskRow.findMany({
          where: { sectionId: section.id },
          orderBy: { sortOrder: "asc" },
        })
      : await prisma.labourRow.findMany({
          where: { sectionId: section.id },
          orderBy: { sortOrder: "asc" },
        });

  return savedRows.map((r) => flattenRow(r, fields));
}
