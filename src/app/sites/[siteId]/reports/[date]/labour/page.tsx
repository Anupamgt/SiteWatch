import { notFound } from "next/navigation";
import { requireSiteAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { isValidDateParam } from "@/lib/dates";
import { getOrCreateReport, loadSectionData } from "@/lib/reports";
import { TopBar } from "@/components/TopBar";
import { SectionEditor } from "@/components/SectionEditor";
import { SECTION_TYPE_LABELS } from "@/lib/constants";

export default async function LabourDeploymentPage({
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
  const { section, fields, rows } = await loadSectionData(siteId, report.id, "LABOUR_DEPLOYMENT");

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        title={SECTION_TYPE_LABELS.LABOUR_DEPLOYMENT}
        userName={user.name ?? undefined}
        backHref={`/sites/${siteId}/reports/${date}`}
      />
      <SectionEditor
        reportId={report.id}
        sectionType="LABOUR_DEPLOYMENT"
        sectionLabel={SECTION_TYPE_LABELS.LABOUR_DEPLOYMENT}
        fields={fields}
        initialRows={rows}
        initialStatus={section.status}
        standardShiftHours={Number(site.standardShiftHours)}
        backHref={`/sites/${siteId}/reports/${date}`}
      />
    </div>
  );
}
