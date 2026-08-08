import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { TicketsHomePanel } from "@/components/tickets/TicketsHomePanel";
import { getDictionary } from "@/lib/i18n/server";

export default async function TicketsListPage({
  searchParams,
}: {
  searchParams: Promise<{ includeClosed?: string }>;
}) {
  const user = await requireUser();
  const { dict } = await getDictionary();
  const sp = await searchParams;
  const includeClosed = sp.includeClosed === "1";

  const memberships =
    user.role === "ADMIN"
      ? null
      : await prisma.siteMembership.findMany({
          where: { userId: user.id },
          select: { siteId: true },
        });

  const tickets = await prisma.ticket.findMany({
    where: {
      deletedAt: null,
      ...(includeClosed ? {} : { status: { not: "CLOSED" } }),
      ...(user.role === "ADMIN"
        ? {}
        : {
            siteId: { in: (memberships ?? []).map((m) => m.siteId) },
            OR: [{ raisedById: user.id }, { assignees: { some: { userId: user.id } } }],
          }),
    },
    include: {
      site: { select: { id: true, code: true, name: true } },
      raisedBy: { select: { id: true, name: true } },
      assignees: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        title={dict.tickets.wordPlural}
        userName={user.name ?? undefined}
        backHref={user.role === "ADMIN" ? "/admin" : "/sites"}
      />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm leading-relaxed text-slate-500">{dict.tickets.listHelp}</p>
          <div className="flex gap-3 text-sm">
            {includeClosed ? (
              <Link href="/tickets" className="self-center text-slate-600 hover:underline">
                {dict.tickets.hideClosed}
              </Link>
            ) : (
              <Link
                href="/tickets?includeClosed=1"
                className="self-center text-slate-600 hover:underline"
              >
                {dict.tickets.showClosed}
              </Link>
            )}
            <Link
              href="/tickets/new"
              className="ads-btn ads-btn-primary px-3 py-2 text-sm"
            >
              {dict.tickets.raise}
            </Link>
          </div>
        </div>

        <TicketsHomePanel
          tickets={tickets}
          raiseHref="/tickets/new"
          listHref="/tickets"
          title={includeClosed ? dict.tickets.allTitle : dict.tickets.openTitle}
        />
      </main>
    </div>
  );
}
