import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { parseDateOnly, todayInAppTimezone, formatDisplayDate } from "@/lib/dates";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";

export default async function SitesPage() {
  const user = await requireUser();
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

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title="My Sites" userName={user.name ?? undefined} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-500">Today — {formatDisplayDate(todayDate)}</p>
          <Link
            href="/machines"
            className="text-sm font-medium text-amber-700 hover:underline"
          >
            Machines →
          </Link>
        </div>

        {sites.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No sites assigned yet. Contact your administrator.
            {user.role === "SUPERVISOR" ? " (Site supervisors cannot access People.)" : ""}
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
                    className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-slate-900">{site.name}</p>
                        <p className="text-sm text-slate-500">
                          {site.code} · {site.projectName}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                        {site.code}
                      </span>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <StatusBadge value={work?.status ?? "NOT_STARTED"} />
                      <span className="text-xs text-slate-400 self-center">Work Programme</span>
                      <span className="mx-1 text-slate-300">·</span>
                      <StatusBadge value={labour?.status ?? "NOT_STARTED"} />
                      <span className="text-xs text-slate-400 self-center">Labour</span>
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
