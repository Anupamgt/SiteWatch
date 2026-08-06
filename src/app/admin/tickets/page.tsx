import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { TicketsHomePanel } from "@/components/tickets/TicketsHomePanel";
import { getDictionary } from "@/lib/i18n/server";

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ includeClosed?: string; siteId?: string }>;
}) {
  await requireAdmin();
  const { dict } = await getDictionary();
  const sp = await searchParams;
  const includeClosed = sp.includeClosed === "1";

  const tickets = await prisma.ticket.findMany({
    where: {
      deletedAt: null,
      ...(sp.siteId ? { siteId: sp.siteId } : {}),
      ...(includeClosed ? {} : { status: { not: "CLOSED" } }),
    },
    include: {
      site: { select: { id: true, code: true, name: true } },
      raisedBy: { select: { id: true, name: true } },
      assignees: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const sites = await prisma.site.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{dict.tickets.wordPlural}</h1>
          <p className="text-sm leading-relaxed text-slate-500">{dict.tickets.listHelp}</p>
        </div>
        <Link
          href="/tickets/new"
          className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900"
        >
          {dict.tickets.raise}
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border bg-white p-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">{dict.tickets.site}</span>
          <select
            name="siteId"
            defaultValue={sp.siteId ?? ""}
            className="min-h-11 rounded-lg border px-3"
          >
            <option value="">{dict.common.all}</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="includeClosed" value="1" defaultChecked={includeClosed} />
          {dict.tickets.showClosed}
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm text-white">
          {dict.common.apply}
        </button>
      </form>

      <TicketsHomePanel
        tickets={tickets}
        raiseHref="/tickets/new"
        listHref="/admin/tickets"
        title={includeClosed ? dict.tickets.allTitle : dict.tickets.openTitle}
      />
    </main>
  );
}
