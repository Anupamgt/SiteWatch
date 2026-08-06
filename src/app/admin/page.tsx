import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { todayInAppTimezone, startOfTodayInAppTimezone } from "@/lib/dates";
import { getSiteDashboard } from "@/lib/dashboard";
import { getDashboardInsights } from "@/lib/dashboardInsights";
import { DashboardInsightsPanel } from "@/components/DashboardInsightsPanel";

export default async function AdminHomePage() {
  const sites = await prisma.site.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const today = todayInAppTimezone();
  const startToday = startOfTodayInAppTimezone();

  const overdueCount = await prisma.correctiveAction.count({
    where: { status: { not: "CLOSED" }, dueDate: { lt: startToday } },
  });

  const [rows, insights] = await Promise.all([
    Promise.all(
      sites.map(async (site) => {
        const dash = await getSiteDashboard(site.id, today, today);
        return { site, dash };
      }),
    ),
    getDashboardInsights("all"),
  ]);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Portfolio overview</h1>
          <p className="text-sm text-slate-500">Today&apos;s submission status across active sites.</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          Overdue corrective actions: <strong>{overdueCount}</strong>
        </div>
      </div>

      <DashboardInsightsPanel
        insights={insights}
        machinesHref="/admin/machines"
        title="Workforce & machines"
      />

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Today submitted</th>
              <th className="px-4 py-3">Open actions</th>
              <th className="px-4 py-3">Overdue</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ site, dash }) => (
              <tr key={site.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{site.name}</td>
                <td className="px-4 py-3 text-slate-600">{site.code}</td>
                <td className="px-4 py-3">
                  {dash.tiles.reportsSubmitted}/{dash.tiles.reportsExpected}
                </td>
                <td className="px-4 py-3">{dash.tiles.openActions}</td>
                <td className="px-4 py-3 text-red-700">{dash.tiles.overdueActions}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/sites/${site.id}`}
                    className="font-medium text-amber-700 hover:underline"
                  >
                    Dashboard →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
