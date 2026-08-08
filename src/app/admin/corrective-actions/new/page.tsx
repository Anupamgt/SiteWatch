import { prisma } from "@/lib/prisma";
import { NewActionForm } from "@/components/admin/NewActionForm";

export default async function NewCorrectiveActionPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string; reportId?: string; taskRowId?: string }>;
}) {
  const sp = await searchParams;
  const [sites, engineers] = await Promise.all([
    prisma.site.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: "ENGINEER", isActive: true },
      include: { memberships: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-xl space-y-4">
      <h1 className="ads-page-title text-2xl">Raise corrective action</h1>
      <NewActionForm
        sites={sites.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
        engineers={engineers.map((e) => ({
          id: e.id,
          name: e.name,
          email: e.email,
          siteIds: e.memberships.map((m) => m.siteId),
        }))}
        defaults={{
          siteId: sp.siteId || "",
          reportId: sp.reportId || "",
          taskRowId: sp.taskRowId || "",
        }}
      />
    </main>
  );
}
