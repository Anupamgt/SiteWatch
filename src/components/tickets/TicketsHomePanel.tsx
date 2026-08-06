import Link from "next/link";

export type TicketListItem = {
  id: string;
  title: string;
  status: string;
  site: { code: string; name: string };
  raisedBy: { name: string };
  assignees: Array<{ user: { name: string } }>;
  updatedAt?: Date | string;
};

export function TicketsHomePanel({
  tickets,
  raiseHref,
  listHref,
  title = "Open tickets",
}: {
  tickets: TicketListItem[];
  raiseHref: string;
  listHref: string;
  title?: string;
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500">Work orders assigned to you or raised by you.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href={raiseHref} className="font-medium text-amber-700 hover:underline">
            Raise ticket
          </Link>
          <Link href={listHref} className="font-medium text-slate-600 hover:underline">
            All →
          </Link>
        </div>
      </div>

      {tickets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
          No open tickets.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border border-slate-200 bg-white">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tickets/${t.id}`}
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{t.title}</p>
                  <p className="text-xs text-slate-500">
                    {t.site.code} · {t.raisedBy.name} →{" "}
                    {t.assignees.map((a) => a.user.name).join(", ") || "—"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {t.status.replaceAll("_", " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
