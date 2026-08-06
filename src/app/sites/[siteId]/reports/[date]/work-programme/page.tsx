import { notFound } from "next/navigation";
import { requireSiteAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { isValidDateParam } from "@/lib/dates";
import { getOrCreateReport, loadSectionData } from "@/lib/reports";
import { TopBar } from "@/components/TopBar";
import { SectionEditor } from "@/components/SectionEditor";
import { SECTION_TYPE_LABELS } from "@/lib/constants";

export default async function WorkProgrammePage({
  params,
}: {
  params: Promise<{ siteId: string; date: string }>;
}) {
  const { siteId, date } = await params;
  if (!isValidDateParam(date)) notFound();

  const user = await requireSiteAccess(siteId);

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) notFound();

  const report = await getOrCreateReport(siteId, date, user.id);
  const [{ section, fields, rows }, ticketOptions] = await Promise.all([
    loadSectionData(siteId, report.id, "WORK_PROGRAMME"),
    prisma.ticket.findMany({
      where: { siteId, deletedAt: null, status: { not: "CLOSED" } },
      select: { id: true, title: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        title={SECTION_TYPE_LABELS.WORK_PROGRAMME}
        userName={user.name ?? undefined}
        backHref={`/sites/${siteId}/reports/${date}`}
      />
      <SectionEditor
        reportId={report.id}
        sectionType="WORK_PROGRAMME"
        sectionLabel={SECTION_TYPE_LABELS.WORK_PROGRAMME}
        fields={fields}
        initialRows={rows}
        initialStatus={section.status}
        standardShiftHours={Number(site.standardShiftHours)}
        backHref={`/sites/${siteId}/reports/${date}`}
        siteId={siteId}
        ticketOptions={ticketOptions}
      />
    </div>
  );
}
