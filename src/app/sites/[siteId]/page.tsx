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
        <section className="ads-surface p-4">
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

        <section className="ads-surface p-4">
          <h2 className="mb-3 text-base font-semibold text-[var(--ads-text)]">{dict.sites.openReport}</h2>
          <GoToDateForm siteId={siteId} defaultDate={today} />
          <Link
            href={`/sites/${siteId}/machines`}
            className="ads-btn ads-btn-default mt-3 block min-h-12 w-full text-center text-sm"
          >
            {dict.sites.machinesLink}
          </Link>
          <Link
            href={`/tickets/new?siteId=${siteId}`}
            className="ads-btn ads-btn-default mt-2 block min-h-12 w-full text-center text-sm"
          >
            {dict.sites.raiseTicket}
          </Link>
          <Link
            href="/my/corrective-actions"
            className="ads-btn ads-btn-default mt-2 block min-h-12 w-full text-center text-sm"
          >
            {dict.sites.myAlerts}
          </Link>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">{dict.sites.recentReports}</h2>
          {recentReports.length === 0 ? (
            <p className="ads-empty p-6">
              {dict.sites.noReports}
            </p>
          ) : (
            <ul className="ads-list space-y-0">
              {recentReports.map((r) => {
                const work = r.sections.find((s) => s.type === "WORK_PROGRAMME");
                const labour = r.sections.find((s) => s.type === "LABOUR_DEPLOYMENT");
                return (
                  <li key={r.id}>
                    <Link
                      href={`/sites/${siteId}/reports/${formatDateOnly(r.reportDate)}`}
                      className="ads-list-row flex items-center justify-between"
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
