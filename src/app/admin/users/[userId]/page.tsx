import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PersonForm } from "@/components/admin/PersonForm";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: true },
  });
  if (!user) notFound();

  const sites = await prisma.site.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Edit person</h1>
      <PersonForm
        mode="edit"
        sites={sites}
        initial={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          isActive: user.isActive,
          hasPassword: Boolean(user.passwordHash),
          siteIds: user.memberships.map((m) => m.siteId),
        }}
      />
    </main>
  );
}
