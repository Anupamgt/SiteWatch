"use client";

import Link from "next/link";
import type { DashboardInsights } from "@/lib/dashboardInsights";
import { formatDisplayDate, parseDateOnly } from "@/lib/dates";

export function DashboardInsightsPanel({
  insights,
  machinesHref,
  title = "Site workforce & machines",
}: {
  insights: DashboardInsights;
  machinesHref?: string;
  title?: string;
}) {
  const yDate = formatDisplayDate(parseDateOnly(insights.labourPresentYesterday.date));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500">
            Live from memberships, yesterday&apos;s labour reports, and the machines register.
          </p>
        </div>
        {machinesHref && (
          <Link href={machinesHref} className="text-sm font-medium text-amber-700 hover:underline">
            Manage machines →
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InsightCard
          title="Total engineers"
          value={String(insights.engineers.total)}
          detail={
            insights.engineers.names.length === 0
              ? "None assigned"
              : insights.engineers.names.map((p) => p.name).join(", ")
          }
        />
        <InsightCard
          title="Total supervisors"
          value={String(insights.supervisors.total)}
          detail={
            insights.supervisors.names.length === 0
              ? "None assigned"
              : insights.supervisors.names.map((p) => p.name).join(", ")
          }
        />
        <InsightCard
          title="Labour present yesterday"
          value={String(insights.labourPresentYesterday.total)}
          detail={
            insights.labourPresentYesterday.byCategory.length === 0
              ? `${yDate} · no labour rows`
              : `${yDate} · ${insights.labourPresentYesterday.byCategory
                  .slice(0, 4)
                  .map((c) => `${c.category}: ${c.present}`)
                  .join(" · ")}`
          }
        />
        <InsightCard
          title="Machines"
          value={`${insights.machines.owned} owned / ${insights.machines.rented} rented`}
          detail={`${insights.machines.active} active · ${insights.machines.items.length} total`}
        />
      </div>

      {insights.machines.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Machine</th>
                <th className="px-3 py-2">Site</th>
                <th className="px-3 py-2">Ownership</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Owner / vendor</th>
              </tr>
            </thead>
            <tbody>
              {insights.machines.items.slice(0, 12).map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">
                    {m.name}
                    {m.category ? <span className="text-slate-500"> · {m.category}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{m.siteCode}</td>
                  <td className="px-3 py-2">
                    <OwnershipBadge ownership={m.ownership} />
                  </td>
                  <td className="px-3 py-2 text-slate-600">{m.status.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2 text-slate-600">{m.ownerLabel || "—"}</td>
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
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
      <p className="mt-1 line-clamp-3 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export function OwnershipBadge({ ownership }: { ownership: "OWNED" | "RENTED" }) {
  const owned = ownership === "OWNED";
  return (
    <span
      className={
        owned
          ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
          : "rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800"
      }
    >
      {owned ? "Owned by us" : "On rent"}
    </span>
  );
}
