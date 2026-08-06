import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSiteDashboard } from "@/lib/dashboard";
import { getDashboardInsights } from "@/lib/dashboardInsights";
import { DashboardInsightsPanel } from "@/components/DashboardInsightsPanel";
import { todayInAppTimezone, formatDisplayDate, parseDateOnly } from "@/lib/dates";
import { StatusBadge } from "@/components/StatusBadge";
import { subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/constants";

export default async function SiteDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { siteId } = await params;
  const sp = await searchParams;
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) notFound();

  const to = sp.to || todayInAppTimezone();
  const from =
    sp.from || formatInTimeZone(subDays(new Date(), 6), APP_TIMEZONE, "yyyy-MM-dd");
  const [dash, insights] = await Promise.all([
    getSiteDashboard(siteId, from, to),
    getDashboardInsights([siteId]),
  ]);
  const pct = dash.tiles.avgPercentComplete;

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{site.name}</h1>
          <p className="text-sm text-slate-500">
            {site.code} · {site.projectName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/export/site/${siteId}?from=${from}&to=${to}`}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Export Excel
          </a>
          <Link
            href={`/admin/machines?siteId=${siteId}`}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
          >
            Machines
          </Link>
          <Link
            href={`/admin/sites/${siteId}/fields`}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
          >
            Fields
          </Link>
          <Link
            href={`/admin/sites/${siteId}/settings`}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
          >
            Settings
          </Link>
        </div>
      </div>

      <DashboardInsightsPanel
        insights={insights}
        machinesHref={`/admin/machines?siteId=${siteId}`}
        title={`${site.code} · workforce & machines`}
      />

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">From</label>
          <input type="date" name="from" defaultValue={from} className="rounded-md border px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">To</label>
          <input type="date" name="to" defaultValue={to} className="rounded-md border px-3 py-2" />
        </div>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
          Apply
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          title="Reports submitted"
          value={`${dash.tiles.reportsSubmitted} / ${dash.tiles.reportsExpected}`}
        />
        <Tile
          title="Avg % complete"
          value={
            pct == null
              ? "—"
              : new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 }).format(
                  pct
                )
          }
        />
        <Tile
          title="Corrective actions"
          value={`${dash.tiles.openActions} open · ${dash.tiles.overdueActions} overdue`}
        />
        <Tile
          title="Labour"
          value={`${dash.tiles.plannedStaff} planned / ${dash.tiles.actualPresent} present · ${dash.tiles.totalManHours} MH`}
        />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Recent reports</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Engineer</th>
                <th className="px-3 py-2 text-left">Work</th>
                <th className="px-3 py-2 text-left">Labour</th>
                <th className="px-3 py-2 text-left">Tasks</th>
                <th className="px-3 py-2 text-left">Approved</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {dash.recentReports.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{formatDisplayDate(parseDateOnly(r.date))}</td>
                  <td className="px-3 py-2">{r.engineer || "—"}</td>
                  <td className="px-3 py-2">
                    {r.workStatus ? <StatusBadge value={r.workStatus} /> : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.labourStatus ? <StatusBadge value={r.labourStatus} /> : "—"}
                  </td>
                  <td className="px-3 py-2">{r.taskCount}</td>
                  <td className="px-3 py-2">{r.approved ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/sites/${siteId}/reports/${r.date}`}
                      className="text-amber-700 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Flagged tasks</h2>
          <ul className="divide-y rounded-lg border border-slate-200 bg-white">
            {dash.flaggedTasks.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-500">None in range</li>
            )}
            {dash.flaggedTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    {t.taskCode} · {t.description}
                  </p>
                  <p className="text-slate-500">{t.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={t.status} />
                  <Link
                    href={`/admin/corrective-actions/new?siteId=${siteId}&taskRowId=${t.id}&reportId=${t.reportId}`}
                    className="text-xs font-medium text-amber-700 hover:underline"
                  >
                    Raise action
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Corrective actions</h2>
          <ul className="divide-y rounded-lg border border-slate-200 bg-white">
            {dash.correctiveActions.slice(0, 10).map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{a.title}</p>
                  {a.overdue ? <StatusBadge value="OVERDUE" /> : <StatusBadge value={a.status} />}
                </div>
                <p className="text-slate-500">
                  {a.assignedTo} · due {a.dueDate || "—"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function Tile({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
