import { notFound } from "next/navigation";
import { requireSiteAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { MachinesManager, type MachineRow } from "@/components/machines/MachinesManager";

export default async function SiteMachinesPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const user = await requireSiteAccess(siteId);

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, code: true, name: true, isActive: true },
  });
  if (!site || !site.isActive) notFound();

  const machines = await prisma.machine.findMany({
    where: { siteId },
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

  // Engineers, supervisors, and admins with site access can edit.
  const canEdit = true;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        title={`${site.code} · Machines`}
        userName={user.name ?? undefined}
        backHref={`/sites/${siteId}`}
      />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Machines — {site.name}</h1>
          <p className="text-sm text-slate-500">
            Mark each unit as owned by us or on rent. Changes save immediately for the site team.
          </p>
        </div>
        <MachinesManager
          machines={rows}
          sites={[{ id: site.id, code: site.code, name: site.name }]}
          canEdit={canEdit}
          defaultSiteId={siteId}
        />
      </main>
    </div>
  );
}
