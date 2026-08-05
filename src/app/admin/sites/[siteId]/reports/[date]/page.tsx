import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isValidDateParam, parseDateOnly, formatDisplayDate, formatDateOnly } from "@/lib/dates";
import { StatusBadge } from "@/components/StatusBadge";
import { AdminReportActions } from "@/components/admin/AdminReportActions";

export default async function AdminReportViewPage({
  params,
}: {
  params: Promise<{ siteId: string; date: string }>;
}) {
  const { siteId, date } = await params;
  if (!isValidDateParam(date)) notFound();

  const report = await prisma.report.findUnique({
    where: { siteId_reportDate: { siteId, reportDate: parseDateOnly(date) } },
    include: {
      site: true,
      approvedBy: true,
      sections: {
        include: {
          taskRows: { orderBy: { sortOrder: "asc" } },
          labourRows: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!report) notFound();

  const work = report.sections.find((s) => s.type === "WORK_PROGRAMME");
  const labour = report.sections.find((s) => s.type === "LABOUR_DEPLOYMENT");

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {report.site.name} · {formatDisplayDate(report.reportDate)}
          </h1>
          <p className="text-sm text-slate-500">
            Engineer: {report.siteEngineerName || "—"} · Supervisor:{" "}
            {report.siteSupervisorName || "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/export/site/${siteId}?date=${formatDateOnly(report.reportDate)}`}
            className="rounded-md border bg-white px-3 py-2 text-sm font-medium"
          >
            Export Excel
          </a>
          <Link href={`/admin/sites/${siteId}`} className="rounded-md border bg-white px-3 py-2 text-sm">
            Dashboard
          </Link>
        </div>
      </div>

      <AdminReportActions
        reportId={report.id}
        approved={Boolean(report.approvedAt)}
        approvedBy={report.approvedBy?.name ?? null}
        workStatus={work?.status ?? null}
        labourStatus={labour?.status ?? null}
      />

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 font-semibold">
          Work Programme{" "}
          {work ? <StatusBadge value={work.status} /> : null}
        </h2>
        <ul className="divide-y text-sm">
          {(work?.taskRows ?? []).map((t) => (
            <li key={t.id} className="flex justify-between gap-3 py-2">
              <span>
                {t.taskCode} — {t.plannedWorkDescription}
              </span>
              <StatusBadge value={t.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 font-semibold">
          Labour{" "}
          {labour ? <StatusBadge value={labour.status} /> : null}
        </h2>
        <ul className="divide-y text-sm">
          {(labour?.labourRows ?? []).map((l) => (
            <li key={l.id} className="flex justify-between gap-3 py-2">
              <span>{l.labourCategory}</span>
              <span className="text-slate-500">
                {l.actualPresent}/{l.plannedStaff}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
