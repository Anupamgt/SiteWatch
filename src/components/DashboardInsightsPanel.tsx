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
          <h2 className="text-base font-semibold text-slate-800">{heading}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{t("insights.help")}</p>
        </div>
        {machinesHref && (
          <Link href={machinesHref} className="text-sm font-medium text-amber-700 hover:underline">
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
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">{t("machines.title")}</th>
                <th className="px-3 py-2">Site</th>
                <th className="px-3 py-2">{t("tickets.status")}</th>
                <th className="px-3 py-2">{t("machines.owned")} / {t("machines.rented")}</th>
              </tr>
            </thead>
            <tbody>
              {insights.machines.items.slice(0, 12).map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 font-medium">
                    {m.name}
                    {m.category ? <span className="text-slate-500"> · {m.category}</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{m.siteCode}</td>
                  <td className="px-3 py-2.5 text-slate-600">{m.status.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2.5">
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
      <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-slate-500">{detail}</p>
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
          ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
          : "rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800"
      }
    >
      {owned ? t("machines.owned") : t("machines.rented")}
    </span>
  );
}
