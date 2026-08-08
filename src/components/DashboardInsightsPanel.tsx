"use client";

import Link from "next/link";
import type { DashboardInsights } from "@/lib/dashboardInsights";
import { formatDisplayDate, parseDateOnly } from "@/lib/dates";
import { useI18n } from "@/components/i18n/I18nProvider";

export function DashboardInsightsPanel({
  insights,
  machinesHref,
  title,
}: {
  insights: DashboardInsights;
  machinesHref?: string;
  title?: string;
}) {
  const { t } = useI18n();
  const yDate = formatDisplayDate(parseDateOnly(insights.labourPresentYesterday.date));
  const heading = title ?? t("insights.title");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--ads-text)]">{heading}</h2>
          <p className="mt-0.5 text-sm text-[var(--ads-text-subtle)]">{t("insights.help")}</p>
        </div>
        {machinesHref && (
          <Link href={machinesHref} className="ads-link text-sm">
            {t("machines.manage")} →
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InsightCard
          title={t("insights.engineers")}
          value={String(insights.engineers.total)}
          detail={
            insights.engineers.names.length === 0
              ? t("insights.noneAssigned")
              : insights.engineers.names.map((p) => p.name).join(", ")
          }
        />
        <InsightCard
          title={t("insights.supervisors")}
          value={String(insights.supervisors.total)}
          detail={
            insights.supervisors.names.length === 0
              ? t("insights.noneAssigned")
              : insights.supervisors.names.map((p) => p.name).join(", ")
          }
        />
        <InsightCard
          title={t("insights.labourYesterday")}
          value={String(insights.labourPresentYesterday.total)}
          detail={
            insights.labourPresentYesterday.byCategory.length === 0
              ? `${yDate} · ${t("insights.noLabour")}`
              : `${yDate} · ${insights.labourPresentYesterday.byCategory
                  .slice(0, 4)
                  .map((c) => `${c.category}: ${c.present}`)
                  .join(" · ")}`
          }
        />
        <InsightCard
          title={t("insights.machines")}
          value={`${insights.machines.owned} ${t("machines.owned")} / ${insights.machines.rented} ${t("machines.rented")}`}
          detail={`${insights.machines.active} · ${insights.machines.items.length}`}
        />
      </div>

      {insights.machines.items.length > 0 && (
        <div className="ads-table-wrap">
          <table className="ads-table">
            <thead>
              <tr>
                <th>{t("machines.title")}</th>
                <th>Site</th>
                <th>{t("tickets.status")}</th>
                <th>
                  {t("machines.owned")} / {t("machines.rented")}
                </th>
              </tr>
            </thead>
            <tbody>
              {insights.machines.items.slice(0, 12).map((m) => (
                <tr key={m.id}>
                  <td className="font-medium">
                    {m.name}
                    {m.category ? (
                      <span className="text-[var(--ads-text-subtle)]"> · {m.category}</span>
                    ) : null}
                  </td>
                  <td className="text-[var(--ads-text-subtle)]">{m.siteCode}</td>
                  <td className="text-[var(--ads-text-subtle)]">{m.status.replaceAll("_", " ")}</td>
                  <td>
                    <OwnershipBadge ownership={m.ownership} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function InsightCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="ads-surface p-4">
      <p className="ads-label normal-case tracking-normal">{title}</p>
      <p className="mt-2 text-lg font-semibold text-[var(--ads-text)]">{value}</p>
      <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-[var(--ads-text-subtle)]">{detail}</p>
    </div>
  );
}

export function OwnershipBadge({ ownership }: { ownership: "OWNED" | "RENTED" }) {
  const { t } = useI18n();
  const owned = ownership === "OWNED";
  return (
    <span
      className={
        owned
          ? "ads-lozenge bg-[#22a06b14] text-[var(--ads-success-bold)]"
          : "ads-lozenge bg-[#1d7afc14] text-[var(--ads-information)]"
      }
    >
      {owned ? t("machines.owned") : t("machines.rented")}
    </span>
  );
}
