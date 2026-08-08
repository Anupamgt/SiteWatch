import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { todayInAppTimezone, startOfTodayInAppTimezone } from "@/lib/dates";
import { getSiteDashboard } from "@/lib/dashboard";
import { getDashboardInsights } from "@/lib/dashboardInsights";
import { DashboardInsightsPanel } from "@/components/DashboardInsightsPanel";
import { getOpenTicketsForHomepages } from "@/lib/tickets";
import { TicketsHomePanel } from "@/components/tickets/TicketsHomePanel";

export default async function AdminHomePage() {
  const admin = await requireAdmin();
  const sites = await prisma.site.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const today = todayInAppTimezone();
  const startToday = startOfTodayInAppTimezone();

  const overdueCount = await prisma.correctiveAction.count({
    where: { status: { not: "CLOSED" }, dueDate: { lt: startToday } },
  });

  const [rows, insights, openTickets] = await Promise.all([
    Promise.all(
      sites.map(async (site) => {
        const dash = await getSiteDashboard(site.id, today, today);
        return { site, dash };
      }),
    ),
    getDashboardInsights("all"),
    getOpenTicketsForHomepages({ userId: admin.id, role: admin.role, take: 8 }),
  ]);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="ads-page-title text-2xl">Portfolio overview</h1>
          <p className="ads-page-subtitle">Today&apos;s submission status across active sites.</p>
        </div>
        <div className="ads-flag ads-flag-error px-4 py-2 text-sm text-[var(--ads-danger)]">
          Overdue corrective actions: <strong>{overdueCount}</strong>
        </div>
      </div>

      <TicketsHomePanel
        tickets={openTickets}
        raiseHref="/tickets/new"
        listHref="/admin/tickets"
        title="Open tickets"
      />

      <DashboardInsightsPanel
        insights={insights}
        machinesHref="/admin/machines"
        title="Workforce & machines"
      />

      <div className="ads-table-wrap">
        <table className="ads-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>Code</th>
              <th>Today submitted</th>
              <th>Open actions</th>
              <th>Overdue</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ site, dash }) => (
              <tr key={site.id}>
                <td className="font-medium text-[var(--ads-text)]">{site.name}</td>
                <td className="text-[var(--ads-text-subtle)]">{site.code}</td>
                <td className="px-4 py-3">{dash.tiles.reportsSubmitted}/{dash.tiles.reportsExpected}</td>
                <td className="px-4 py-3">{dash.tiles.openActions}</td>
                <td className="px-4 py-3 text-[var(--ads-danger)]">{dash.tiles.overdueActions}</td>
                <td className="text-right">
                  <Link href={`/admin/sites/${site.id}`} className="ads-link">
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
