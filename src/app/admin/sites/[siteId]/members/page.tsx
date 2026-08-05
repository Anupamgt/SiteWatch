import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MembersManager } from "@/components/admin/MembersManager";

export default async function SiteMembersPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) notFound();

  const [members, engineers] = await Promise.all([
    prisma.siteMembership.findMany({
      where: { siteId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Members — {site.name}</h1>
      <MembersManager
        siteId={siteId}
        members={members.map((m) => m.user)}
        candidates={engineers}
      />
    </main>
  );
}
