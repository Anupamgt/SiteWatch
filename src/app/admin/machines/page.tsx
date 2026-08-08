import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MachinesManager, type MachineRow } from "@/components/machines/MachinesManager";

export default async function AdminMachinesPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const sp = await searchParams;
  const sites = await prisma.site.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });

  const machines = await prisma.machine.findMany({
    where: sp.siteId ? { siteId: sp.siteId } : undefined,
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

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Machines</h1>
        <p className="text-sm text-slate-500">
          Company fleet — owned by us or on rent. Editable for every site.
        </p>
      </div>

      <form method="get" className="ads-surface flex flex-wrap items-end gap-2 p-3">
        <label className="text-sm">
          <span className="ads-label normal-case tracking-normal">Filter by site</span>
          <select name="siteId" defaultValue={sp.siteId ?? ""} className="ads-input min-h-10">
            <option value="">All sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="ads-btn ads-btn-primary text-sm">
          Apply
        </button>
        {sp.siteId && (
          <Link href="/admin/machines" className="ads-link text-sm">
            Clear
          </Link>
        )}
      </form>

      <MachinesManager
        machines={rows}
        sites={sites}
        canEdit
        defaultSiteId={sp.siteId ?? sites[0]?.id}
      />
    </main>
  );
}
