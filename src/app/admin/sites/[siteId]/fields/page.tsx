import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getFieldDefinitionsForAdmin } from "@/lib/fields";
import { FieldConfigEditor } from "@/components/admin/FieldConfigEditor";

export default async function SiteFieldsPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { siteId } = await params;
  const sp = await searchParams;
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) notFound();

  const sectionType =
    sp.section === "LABOUR_DEPLOYMENT" ? "LABOUR_DEPLOYMENT" : "WORK_PROGRAMME";
  const fields = await getFieldDefinitionsForAdmin(siteId, sectionType);

  return (
    <main className="space-y-4">
      <div>
        <h1 className="ads-page-title text-2xl">Field configuration — {site.name}</h1>
        <p className="ads-page-subtitle">
          System fields can be hidden/relabelled/reordered but not deleted.
        </p>
      </div>
      <div className="flex gap-2">
        <Link
          href={`/admin/sites/${siteId}/fields?section=WORK_PROGRAMME`}
          className={
            sectionType === "WORK_PROGRAMME"
              ? "ads-btn ads-btn-primary"
              : "ads-btn ads-btn-default"
          }
        >
          Work Programme
        </Link>
        <Link
          href={`/admin/sites/${siteId}/fields?section=LABOUR_DEPLOYMENT`}
          className={
            sectionType === "LABOUR_DEPLOYMENT"
              ? "ads-btn ads-btn-primary"
              : "ads-btn ads-btn-default"
          }
        >
          Labour Deployment
        </Link>
      </div>
      <FieldConfigEditor siteId={siteId} sectionType={sectionType} initialFields={fields} />
    </main>
  );
}
