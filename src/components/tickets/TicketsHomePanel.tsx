"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";

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
  title,
}: {
  tickets: TicketListItem[];
  raiseHref: string;
  listHref: string;
  title?: string;
}) {
  const { t, ticketStatus } = useI18n();
  const heading = title ?? t("tickets.openTitle");

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-800">{heading}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{t("tickets.openHelp")}</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link
            href={raiseHref}
            className="rounded-md bg-amber-500 px-3 py-1.5 font-semibold text-slate-900"
          >
            {t("tickets.raise")}
          </Link>
          <Link
            href={listHref}
            className="self-center font-medium text-slate-600 hover:underline"
          >
            {t("tickets.viewAll")} →
          </Link>
        </div>
      </div>

      {tickets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
          {t("tickets.empty")}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border border-slate-200 bg-white shadow-sm">
          {tickets.map((item) => (
            <li key={item.id}>
              <Link
                href={`/tickets/${item.id}`}
                className="flex items-start justify-between gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {item.site.code} · {t("tickets.raisedBy")} {item.raisedBy.name}
                    {item.assignees.length > 0
                      ? ` → ${item.assignees.map((a) => a.user.name).join(", ")}`
                      : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {ticketStatus(item.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
