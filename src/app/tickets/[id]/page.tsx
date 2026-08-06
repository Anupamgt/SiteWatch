import { notFound } from "next/navigation";
import { requireUser, requireSiteAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { TicketDetailClient, type TicketDetail } from "@/components/tickets/TicketDetailClient";
import { listAssignableUsers, ticketInclude } from "@/lib/tickets";
import { formatDateOnly } from "@/lib/dates";
import { getDictionary } from "@/lib/i18n";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { dict } = await getDictionary();
  const { id } = await params;

  const ticket = await prisma.ticket.findFirst({
    where: { id, deletedAt: null },
    include: ticketInclude,
  });
  if (!ticket) notFound();

  await requireSiteAccess(ticket.siteId);
  const assignable = await listAssignableUsers(ticket.siteId);

  const detail: TicketDetail = {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    siteId: ticket.siteId,
    raisedById: ticket.raisedById,
    site: ticket.site,
    raisedBy: ticket.raisedBy,
    closedBy: ticket.closedBy,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    assignees: ticket.assignees,
    descriptionLogs: ticket.descriptionLogs.map((l) => ({
      id: l.id,
      previousDescription: l.previousDescription,
      newDescription: l.newDescription,
      createdAt: l.createdAt.toISOString(),
      changedBy: l.changedBy,
    })),
    taskRows: ticket.taskRows.map((r) => ({
      id: r.id,
      taskCode: r.taskCode,
      plannedWorkDescription: r.plannedWorkDescription,
      status: r.status,
      percentComplete: r.percentComplete,
      section: {
        report: {
          id: r.section.report.id,
          reportDate: formatDateOnly(r.section.report.reportDate),
          siteId: r.section.report.siteId,
        },
      },
    })),
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        title={dict.tickets.word}
        userName={user.name ?? undefined}
        backHref="/tickets"
      />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        <TicketDetailClient
          ticket={detail}
          currentUserId={user.id}
          currentUserRole={user.role}
          assignableUsers={assignable}
        />
      </main>
    </div>
  );
}
