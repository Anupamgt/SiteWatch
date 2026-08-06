import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { RaiseTicketForm } from "@/components/tickets/RaiseTicketForm";

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const sites =
    user.role === "ADMIN"
      ? await prisma.site.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, code: true, name: true },
        })
      : await prisma.site.findMany({
          where: { isActive: true, memberships: { some: { userId: user.id } } },
          orderBy: { name: "asc" },
          select: { id: true, code: true, name: true },
        });

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title="Raise ticket" userName={user.name ?? undefined} backHref="/tickets" />
      <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 py-5">
        <p className="text-sm text-slate-500">
          Create a work order and assign one or more people. Assignees link daily DPR tasks to this
          ticket; you close it after review.
        </p>
        {sites.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
            No sites available.
          </p>
        ) : (
          <RaiseTicketForm
            sites={sites}
            defaultSiteId={sp.siteId}
            cancelHref="/tickets"
          />
        )}
      </main>
    </div>
  );
}
