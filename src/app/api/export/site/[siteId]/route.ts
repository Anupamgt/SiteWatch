import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteAccess, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { getFieldDefinitions } from "@/lib/fields";
import { buildReportWorkbook, type WorkbookReport } from "@/lib/excel/buildWorkbook";
import { isValidDateParam, parseDateOnly } from "@/lib/dates";

function toNum(v: { toNumber?: () => number } | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v.toNumber === "function") return v.toNumber();
  return Number(v);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;
    await requireSiteAccess(siteId);

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new HttpError(404, "Site not found");

    const date = req.nextUrl.searchParams.get("date");
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");

    let where;
    if (date) {
      if (!isValidDateParam(date)) throw new HttpError(400, "Invalid date");
      where = { siteId, reportDate: parseDateOnly(date) };
    } else if (from && to) {
      if (!isValidDateParam(from) || !isValidDateParam(to)) throw new HttpError(400, "Invalid range");
      where = { siteId, reportDate: { gte: parseDateOnly(from), lte: parseDateOnly(to) } };
    } else {
      throw new HttpError(400, "Provide date= or from=&to=");
    }

    const reports = await prisma.report.findMany({
      where,
      include: {
        approvedBy: { select: { name: true } },
        sections: {
          include: {
            taskRows: { include: { attachments: true }, orderBy: { sortOrder: "asc" } },
            labourRows: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
      orderBy: { reportDate: "asc" },
    });

    if (reports.length === 0) throw new HttpError(404, "No reports found for export");

    const [workFields, labourFields] = await Promise.all([
      getFieldDefinitions(siteId, "WORK_PROGRAMME"),
      getFieldDefinitions(siteId, "LABOUR_DEPLOYMENT"),
    ]);

    const payload: WorkbookReport[] = reports.map((r) => {
      const work = r.sections.find((s) => s.type === "WORK_PROGRAMME");
      const labour = r.sections.find((s) => s.type === "LABOUR_DEPLOYMENT");
      return {
        reportDate: r.reportDate,
        projectName: r.projectName,
        locationZone: r.locationZone,
        contractorClient: r.contractorClient,
        siteEngineerName: r.siteEngineerName,
        siteSupervisorName: r.siteSupervisorName,
        weatherCondition: r.weatherCondition,
        dayOfWeek: r.dayOfWeek,
        approvedByName: r.approvedBy?.name ?? null,
        taskRows: (work?.taskRows ?? []).map((t) => ({
          sortOrder: t.sortOrder,
          taskCode: t.taskCode,
          locationStructure: t.locationStructure,
          plannedWorkDescription: t.plannedWorkDescription,
          primaryTradeLead: t.primaryTradeLead,
          targetQty: toNum(t.targetQty),
          achievedQty: toNum(t.achievedQty),
          unit: t.unit,
          percentComplete: t.percentComplete,
          status: t.status,
          varianceReason: t.varianceReason,
          correctiveActionNote: t.correctiveActionNote,
          custom: (t.custom as Record<string, unknown>) ?? {},
          attachmentCount: t.attachments.length,
        })),
        labourRows: (labour?.labourRows ?? []).map((l) => ({
          sortOrder: l.sortOrder,
          labourCategory: l.labourCategory,
          contractorGangLeader: l.contractorGangLeader,
          plannedStaff: l.plannedStaff,
          actualPresent: l.actualPresent,
          otHours: toNum(l.otHours),
          totalManHours: toNum(l.totalManHours),
          assignedWorkArea: l.assignedWorkArea,
          outputDeliveredToday: l.outputDeliveredToday,
          targetStdRate: l.targetStdRate,
          productivityCheck: l.productivityCheck,
          supervisorRemarks: l.supervisorRemarks,
          custom: (l.custom as Record<string, unknown>) ?? {},
        })),
      };
    });

    const workbook = buildReportWorkbook(payload, {
      WORK_PROGRAMME: workFields,
      LABOUR_DEPLOYMENT: labourFields,
    });

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const stamp = date || `${from}_${to}`;
    const filename = `DPR_${site.code}_${stamp}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
