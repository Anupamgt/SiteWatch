import { prisma } from "@/lib/prisma";
import { PersonForm } from "@/components/admin/PersonForm";

export default async function NewUserPage() {
  const sites = await prisma.site.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <h1 className="ads-page-title text-2xl">Add person</h1>
      <PersonForm mode="create" sites={sites} />
    </main>
  );
}
