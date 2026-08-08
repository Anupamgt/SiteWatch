import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSiteAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { isValidDateParam, parseDateOnly, dayOfWeekFromDateOnly, formatDisplayDate } from "@/lib/dates";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { SECTION_TYPE_LABELS } from "@/lib/constants";
import { ReportHeaderEditor } from "@/components/ReportHeaderEditor";

export default async function ReportHeaderPage({
  params,
}: {
  params: Promise<{ siteId: string; date: string }>;
}) {
  const { siteId, date } = await params;
  if (!isValidDateParam(date)) notFound();

  const user = await requireSiteAccess(siteId);

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) notFound();

  const reportDate = parseDateOnly(date);
  const report = await prisma.report.findUnique({
    where: { siteId_reportDate: { siteId, reportDate } },
    include: { sections: true },
  });

  const header = {
    projectName: report?.projectName ?? site.projectName,
    locationZone: report?.locationZone ?? site.locationZone,
    contractorClient: report?.contractorClient ?? site.contractorClient,
    siteEngineerName: report?.siteEngineerName ?? user.name ?? "",
    siteSupervisorName: report?.siteSupervisorName ?? "",
    weatherCondition: report?.weatherCondition ?? "",
    dayOfWeek: report?.dayOfWeek ?? dayOfWeekFromDateOnly(date),
  };

  const work = report?.sections.find((s) => s.type === "WORK_PROGRAMME");
  const labour = report?.sections.find((s) => s.type === "LABOUR_DEPLOYMENT");

  const sections: Array<{ type: "work-programme" | "labour"; label: string; status: string }> = [
    {
      type: "work-programme",
      label: SECTION_TYPE_LABELS.WORK_PROGRAMME,
      status: work?.status ?? "NOT_STARTED",
    },
    {
      type: "labour",
      label: SECTION_TYPE_LABELS.LABOUR_DEPLOYMENT,
      status: labour?.status ?? "NOT_STARTED",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        title={formatDisplayDate(reportDate)}
        userName={user.name ?? undefined}
        backHref={`/sites/${siteId}`}
      />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-5">
        <section className="ads-surface p-4">
          <p className="ads-label mb-3">
            Report header
          </p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <HeaderField label="Project" value={header.projectName} />
            <HeaderField
              label="Date"
              value={`${formatDisplayDate(reportDate)} (${header.dayOfWeek})`}
            />
            <HeaderField label="Location / Zone" value={header.locationZone} />
            <HeaderField label="Contractor / Client" value={header.contractorClient} />
            <HeaderField label="Site Engineer" value={header.siteEngineerName} />
            <HeaderField label="Site Supervisor" value={header.siteSupervisorName} />
            <HeaderField label="Weather" value={header.weatherCondition || "Not recorded yet"} />
          </dl>
        </section>

        <ReportHeaderEditor
          siteId={siteId}
          date={date}
          reportId={report?.id ?? null}
          values={{
            siteEngineerName: header.siteEngineerName,
            siteSupervisorName: header.siteSupervisorName,
            weatherCondition: header.weatherCondition,
          }}
        />

        <p className="text-sm font-semibold text-[var(--ads-text)]">Report sections</p>
        <section className="ads-list space-y-0">
          {sections.map((s) => (
            <Link
              key={s.type}
              href={`/sites/${siteId}/reports/${date}/${s.type}`}
              className="ads-list-row flex items-center justify-between"
            >
              <span className="text-base font-medium text-slate-900">{s.label}</span>
              <StatusBadge value={s.status} />
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}

function HeaderField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="ads-label normal-case tracking-normal">{label}</dt>
      <dd className="font-medium text-[var(--ads-text)]">{value || "—"}</dd>
    </div>
  );
}
