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
          <h1 className="ads-page-title text-2xl">{site.name}</h1>
          <p className="ads-page-subtitle">
            {site.code} · {site.projectName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/export/site/${siteId}?from=${from}&to=${to}`}
            className="ads-btn ads-btn-default text-sm"
          >
            Export Excel
          </a>
          <Link href={`/admin/machines?siteId=${siteId}`} className="ads-btn ads-btn-default text-sm">
            Machines
          </Link>
          <Link href={`/admin/sites/${siteId}/fields`} className="ads-btn ads-btn-default text-sm">
            Fields
          </Link>
          <Link href={`/admin/sites/${siteId}/settings`} className="ads-btn ads-btn-default text-sm">
            Settings
          </Link>
        </div>
      </div>

      <DashboardInsightsPanel
        insights={insights}
        machinesHref={`/admin/machines?siteId=${siteId}`}
        title={`${site.code} · workforce & machines`}
      />

      <form className="ads-surface flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="ads-label normal-case tracking-normal">From</label>
          <input type="date" name="from" defaultValue={from} className="ads-input py-2" />
        </div>
        <div>
          <label className="ads-label normal-case tracking-normal">To</label>
          <input type="date" name="to" defaultValue={to} className="ads-input py-2" />
        </div>
        <button type="submit" className="ads-btn ads-btn-primary text-sm">
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
        <h2 className="text-sm font-semibold text-[var(--ads-text)]">Recent reports</h2>
        <div className="ads-table-wrap">
          <table className="ads-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Engineer</th>
                <th>Work</th>
                <th>Labour</th>
                <th>Tasks</th>
                <th>Approved</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dash.recentReports.map((r) => (
                <tr key={r.id}>
                  <td>{formatDisplayDate(parseDateOnly(r.date))}</td>
                  <td>{r.engineer || "—"}</td>
                  <td>
                    {r.workStatus ? <StatusBadge value={r.workStatus} /> : "—"}
                  </td>
                  <td>
                    {r.labourStatus ? <StatusBadge value={r.labourStatus} /> : "—"}
                  </td>
                  <td>{r.taskCount}</td>
                  <td>{r.approved ? "Yes" : "No"}</td>
                  <td className="text-right">
                    <Link href={`/admin/sites/${siteId}/reports/${r.date}`} className="ads-link">
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
          <h2 className="text-sm font-semibold text-[var(--ads-text)]">Flagged tasks</h2>
          <ul className="ads-list">
            {dash.flaggedTasks.length === 0 && (
              <li className="ads-list-row text-sm text-[var(--ads-text-subtle)]">None in range</li>
            )}
            {dash.flaggedTasks.map((t) => (
              <li key={t.id} className="ads-list-row flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">
                    {t.taskCode} · {t.description}
                  </p>
                  <p className="text-[var(--ads-text-subtle)]">{t.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={t.status} />
                  <Link
                    href={`/admin/corrective-actions/new?siteId=${siteId}&taskRowId=${t.id}&reportId=${t.reportId}`}
                    className="ads-link text-xs"
                  >
                    Raise action
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--ads-text)]">Corrective actions</h2>
          <ul className="ads-list">
            {dash.correctiveActions.slice(0, 10).map((a) => (
              <li key={a.id} className="ads-list-row text-sm">
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
    <div className="ads-surface p-4">
      <p className="ads-label normal-case tracking-normal">{title}</p>
      <p className="mt-2 text-lg font-semibold text-[var(--ads-text)]">{value}</p>
    </div>
  );
}
