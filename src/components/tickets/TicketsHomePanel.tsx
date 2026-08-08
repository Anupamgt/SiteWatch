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
          <h2 className="text-base font-semibold text-[var(--ads-text)]">{heading}</h2>
          <p className="mt-0.5 text-sm text-[var(--ads-text-subtle)]">{t("tickets.openHelp")}</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href={raiseHref} className="ads-btn ads-btn-primary px-3 py-1.5 text-sm">
            {t("tickets.raise")}
          </Link>
          <Link href={listHref} className="ads-link self-center">
            {t("tickets.viewAll")} →
          </Link>
        </div>
      </div>

      {tickets.length === 0 ? (
        <p className="ads-empty">{t("tickets.empty")}</p>
      ) : (
        <ul className="ads-list">
          {tickets.map((item) => (
            <li key={item.id}>
              <Link
                href={`/tickets/${item.id}`}
                className="ads-list-row flex items-start justify-between gap-3 active:bg-[var(--ads-neutral-hovered)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-[var(--ads-text)]">{item.title}</p>
                  <p className="mt-0.5 text-sm text-[var(--ads-text-subtle)]">
                    {item.site.code} · {t("tickets.raisedBy")} {item.raisedBy.name}
                    {item.assignees.length > 0
                      ? ` → ${item.assignees.map((a) => a.user.name).join(", ")}`
                      : ""}
                  </p>
                </div>
                <span className="ads-chip shrink-0">{ticketStatus(item.status)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
