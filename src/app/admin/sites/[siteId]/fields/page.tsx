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
        <h1 className="text-2xl font-semibold">Field configuration — {site.name}</h1>
        <p className="text-sm text-slate-500">
          System fields can be hidden/relabelled/reordered but not deleted.
        </p>
      </div>
      <div className="flex gap-2">
        <Link
          href={`/admin/sites/${siteId}/fields?section=WORK_PROGRAMME`}
          className={`rounded-md px-3 py-2 text-sm ${
            sectionType === "WORK_PROGRAMME" ? "bg-slate-900 text-white" : "bg-white border"
          }`}
        >
          Work Programme
        </Link>
        <Link
          href={`/admin/sites/${siteId}/fields?section=LABOUR_DEPLOYMENT`}
          className={`rounded-md px-3 py-2 text-sm ${
            sectionType === "LABOUR_DEPLOYMENT" ? "bg-slate-900 text-white" : "bg-white border"
          }`}
        >
          Labour Deployment
        </Link>
      </div>
      <FieldConfigEditor siteId={siteId} sectionType={sectionType} initialFields={fields} />
    </main>
  );
}
