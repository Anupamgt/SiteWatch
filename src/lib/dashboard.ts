import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDateOnly, formatDateOnly, startOfTodayInAppTimezone } from "@/lib/dates";

export type SiteDashboard = {
  siteId: string;
  from: string;
  to: string;
  tiles: {
    reportsSubmitted: number;
    reportsExpected: number;
    avgPercentComplete: number | null;
    openActions: number;
    overdueActions: number;
    plannedStaff: number;
    actualPresent: number;
    totalManHours: number;
    absenteeismPct: number | null;
  };
  recentReports: Array<{
    id: string;
    date: string;
    engineer: string | null;
    workStatus: string | null;
    labourStatus: string | null;
    taskCount: number;
    avgPercent: number | null;
    approved: boolean;
  }>;
  flaggedTasks: Array<{
    id: string;
    date: string;
    taskCode: string | null;
    description: string | null;
    status: string;
    reportId: string;
  }>;
  correctiveActions: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    overdue: boolean;
    assignedTo: string;
  }>;
};

function eachDateInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = parseDateOnly(from);
  const end = parseDateOnly(to);
  while (cur.getTime() <= end.getTime()) {
    out.push(formatDateOnly(cur));
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + 1));
  }
  return out;
}

export async function getSiteDashboard(
  siteId: string,
  from: string,
  to: string
): Promise<SiteDashboard> {
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  const today = startOfTodayInAppTimezone();
  const expectedDays = eachDateInclusive(from, to).length;

  const reports = await prisma.report.findMany({
    where: { siteId, reportDate: { gte: fromDate, lte: toDate } },
    include: {
      sections: {
        include: {
          taskRows: true,
          labourRows: true,
        },
      },
      approvedBy: { select: { name: true } },
    },
    orderBy: { reportDate: "desc" },
  });

  let submittedBoth = 0;
  let percentSum = 0;
  let percentCount = 0;
  let plannedStaff = 0;
  let actualPresent = 0;
  let totalManHours = new Prisma.Decimal(0);
  const flaggedTasks: SiteDashboard["flaggedTasks"] = [];

  const recentReports: SiteDashboard["recentReports"] = reports.map((r) => {
    const work = r.sections.find((s) => s.type === "WORK_PROGRAMME");
    const labour = r.sections.find((s) => s.type === "LABOUR_DEPLOYMENT");
    if (work?.status === "SUBMITTED" && labour?.status === "SUBMITTED") {
      submittedBoth += 1;
    }

    const tasks = work?.taskRows ?? [];
    for (const t of tasks) {
      if (t.percentComplete != null) {
        percentSum += t.percentComplete;
        percentCount += 1;
      }
      if (t.status === "DELAYED" || t.status === "ON_HOLD") {
        flaggedTasks.push({
          id: t.id,
          date: formatDateOnly(r.reportDate),
          taskCode: t.taskCode,
          description: t.plannedWorkDescription,
          status: t.status,
          reportId: r.id,
        });
      }
    }

    for (const l of labour?.labourRows ?? []) {
      plannedStaff += l.plannedStaff ?? 0;
      actualPresent += l.actualPresent ?? 0;
      if (l.totalManHours != null) totalManHours = totalManHours.add(l.totalManHours);
    }

    const avgPercent =
      tasks.length > 0
        ? tasks.reduce((s, t) => s + (t.percentComplete ?? 0), 0) / tasks.length
        : null;

    return {
      id: r.id,
      date: formatDateOnly(r.reportDate),
      engineer: r.siteEngineerName,
      workStatus: work?.status ?? null,
      labourStatus: labour?.status ?? null,
      taskCount: tasks.length,
      avgPercent,
      approved: Boolean(r.approvedAt),
    };
  });

  const actions = await prisma.correctiveAction.findMany({
    where: { siteId },
    include: { assignedTo: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const openActions = actions.filter((a) => a.status !== "CLOSED");
  const overdueActions = openActions.filter(
    (a) => a.dueDate != null && a.dueDate.getTime() < today.getTime()
  );

  return {
    siteId,
    from,
    to,
    tiles: {
      reportsSubmitted: submittedBoth,
      reportsExpected: expectedDays,
      avgPercentComplete: percentCount > 0 ? percentSum / percentCount : null,
      openActions: openActions.length,
      overdueActions: overdueActions.length,
      plannedStaff,
      actualPresent,
      totalManHours: totalManHours.toNumber(),
      absenteeismPct:
        plannedStaff > 0 ? 1 - actualPresent / plannedStaff : null,
    },
    recentReports,
    flaggedTasks: flaggedTasks.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20),
    correctiveActions: actions.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      priority: a.priority,
      dueDate: a.dueDate ? formatDateOnly(a.dueDate) : null,
      overdue:
        a.status !== "CLOSED" &&
        a.dueDate != null &&
        a.dueDate.getTime() < today.getTime(),
      assignedTo: a.assignedTo.name,
    })),
  };
}
