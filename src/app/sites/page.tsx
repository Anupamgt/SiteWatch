import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { parseDateOnly, todayInAppTimezone, formatDisplayDate } from "@/lib/dates";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { getOpenTicketsForHomepages } from "@/lib/tickets";
import { TicketsHomePanel } from "@/components/tickets/TicketsHomePanel";
import { getDictionary } from "@/lib/i18n/server";

export default async function SitesPage() {
  const user = await requireUser();
  const { dict } = await getDictionary();
  const today = todayInAppTimezone();
  const todayDate = parseDateOnly(today);

  const sites =
    user.role === "ADMIN"
      ? await prisma.site.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
      : await prisma.site.findMany({
          where: { isActive: true, memberships: { some: { userId: user.id } } },
          orderBy: { name: "asc" },
        });

  const todaysReports = await prisma.report.findMany({
    where: { siteId: { in: sites.map((s) => s.id) }, reportDate: todayDate },
    include: { sections: true },
  });
  const reportBySite = new Map(todaysReports.map((r) => [r.siteId, r]));

  const openTickets = await getOpenTicketsForHomepages({
    userId: user.id,
    role: user.role,
    siteIds: sites.map((s) => s.id),
    take: 6,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title={dict.sites.pageTitle} userName={user.name ?? undefined} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--ads-text-subtle)]">
            {dict.common.today} — {formatDisplayDate(todayDate)}
          </p>
          <div className="flex gap-3 text-sm">
            <Link href="/tickets" className="ads-link">
              {dict.nav.tickets} →
            </Link>
            <Link href="/machines" className="ads-link">
              {dict.nav.machines} →
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <TicketsHomePanel
            tickets={openTickets}
            raiseHref="/tickets/new"
            listHref="/tickets"
          />
        </div>

        {sites.length === 0 ? (
          <div className="ads-empty p-8">
            {dict.common.noSites}
          </div>
        ) : (
          <ul className="space-y-3">
            {sites.map((site) => {
              const report = reportBySite.get(site.id);
              const work = report?.sections.find((s) => s.type === "WORK_PROGRAMME");
              const labour = report?.sections.find((s) => s.type === "LABOUR_DEPLOYMENT");

              return (
                <li key={site.id}>
                  <Link
                    href={`/sites/${site.id}`}
                    className="ads-surface block p-4 active:bg-[var(--ads-neutral)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold text-slate-900">{site.name}</p>
                        <p className="text-sm text-slate-500">
                          {site.code} · {site.projectName}
                        </p>
                      </div>
                      <span className="ads-chip shrink-0">
                        {site.code}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge value={work?.status ?? "NOT_STARTED"} />
                      <span className="text-xs text-slate-400">{dict.sites.workProgramme}</span>
                      <span className="mx-1 text-slate-300">·</span>
                      <StatusBadge value={labour?.status ?? "NOT_STARTED"} />
                      <span className="text-xs text-slate-400">{dict.sites.labour}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
