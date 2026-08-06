import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSiteAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { formatDateOnly, formatDisplayDate, todayInAppTimezone } from "@/lib/dates";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { GoToDateForm } from "@/components/GoToDateForm";
import { getDashboardInsights } from "@/lib/dashboardInsights";
import { DashboardInsightsPanel } from "@/components/DashboardInsightsPanel";
import { getDictionary } from "@/lib/i18n/server";

export default async function SiteHomePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const user = await requireSiteAccess(siteId);
  const { dict } = await getDictionary();

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) notFound();

  const today = todayInAppTimezone();

  const [recentReports, insights] = await Promise.all([
    prisma.report.findMany({
      where: { siteId },
      orderBy: { reportDate: "desc" },
      take: 7,
      include: { sections: true },
    }),
    getDashboardInsights([siteId]),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title={site.name} userName={user.name ?? undefined} backHref="/sites" />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-5">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            {site.code} · {site.projectName}
          </p>
          <p className="text-sm text-slate-600">
            {site.locationZone ?? "—"} · {site.contractorClient ?? "—"}
          </p>
        </section>

        <DashboardInsightsPanel
          insights={insights}
          machinesHref={`/sites/${siteId}/machines`}
        />

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-800">{dict.sites.openReport}</h2>
          <GoToDateForm siteId={siteId} defaultDate={today} />
          <Link
            href={`/sites/${siteId}/machines`}
            className="mt-3 block min-h-12 rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            {dict.sites.machinesLink}
          </Link>
          <Link
            href={`/tickets/new?siteId=${siteId}`}
            className="mt-2 block min-h-12 rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            {dict.sites.raiseTicket}
          </Link>
          <Link
            href="/my/corrective-actions"
            className="mt-2 block min-h-12 rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm font-medium text-amber-800 hover:bg-amber-50"
          >
            {dict.sites.myAlerts}
          </Link>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">{dict.sites.recentReports}</h2>
          {recentReports.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              {dict.sites.noReports}
            </p>
          ) : (
            <ul className="space-y-2">
              {recentReports.map((r) => {
                const work = r.sections.find((s) => s.type === "WORK_PROGRAMME");
                const labour = r.sections.find((s) => s.type === "LABOUR_DEPLOYMENT");
                return (
                  <li key={r.id}>
                    <Link
                      href={`/sites/${siteId}/reports/${formatDateOnly(r.reportDate)}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm active:bg-slate-50"
                    >
                      <span className="text-base font-medium text-slate-900">
                        {formatDisplayDate(r.reportDate)}
                      </span>
                      <span className="flex gap-1.5">
                        <StatusBadge value={work?.status ?? "NOT_STARTED"} />
                        <StatusBadge value={labour?.status ?? "NOT_STARTED"} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
