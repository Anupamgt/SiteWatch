import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { MachinesManager, type MachineRow } from "@/components/machines/MachinesManager";
import { getDashboardInsights } from "@/lib/dashboardInsights";
import { DashboardInsightsPanel } from "@/components/DashboardInsightsPanel";

export default async function MyMachinesPage() {
  const user = await requireUser();

  const sites =
    user.role === "ADMIN"
      ? await prisma.site.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, code: true, name: true },
        })
      : await prisma.site.findMany({
          where: { isActive: true, memberships: { some: { userId: user.id } } },
          orderBy: { name: "asc" },
          select: { id: true, code: true, name: true },
        });

  const siteIds = sites.map((s) => s.id);

  const machines = await prisma.machine.findMany({
    where: { siteId: { in: siteIds } },
    include: { site: { select: { id: true, code: true, name: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  const rows: MachineRow[] = machines.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    ownership: m.ownership,
    status: m.status,
    ownerLabel: m.ownerLabel,
    registration: m.registration,
    dailyRate: m.dailyRate == null ? null : Number(m.dailyRate),
    notes: m.notes,
    isActive: m.isActive,
    siteId: m.siteId,
    site: m.site,
  }));

  const insights = await getDashboardInsights(siteIds.length ? siteIds : []);

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title="Machines" userName={user.name ?? undefined} backHref="/sites" />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-5">
        <DashboardInsightsPanel insights={insights} title="Your sites · workforce & machines" />

        {sites.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No sites assigned yet.{" "}
            <Link href="/sites" className="text-amber-700 hover:underline">
              Back to sites
            </Link>
          </p>
        ) : (
          <MachinesManager
            machines={rows}
            sites={sites}
            canEdit
            defaultSiteId={sites[0]?.id}
          />
        )}
      </main>
    </div>
  );
}
