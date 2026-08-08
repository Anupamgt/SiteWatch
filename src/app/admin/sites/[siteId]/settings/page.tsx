import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SiteSettingsForm } from "@/components/admin/SiteSettingsForm";

export default async function SiteSettingsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) notFound();

  return (
    <main className="mx-auto max-w-lg space-y-4">
      <h1 className="ads-page-title text-2xl">Site settings</h1>
      <SiteSettingsForm
        site={{
          ...site,
          standardShiftHours: Number(site.standardShiftHours),
        }}
      />
    </main>
  );
}
