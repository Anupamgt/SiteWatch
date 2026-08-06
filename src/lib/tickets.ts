import type { Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth-guards";

export const ticketInclude = {
  site: { select: { id: true, code: true, name: true } },
  raisedBy: { select: { id: true, name: true, email: true, role: true } },
  closedBy: { select: { id: true, name: true, email: true } },
  assignees: {
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  },
  descriptionLogs: {
    orderBy: { createdAt: "desc" as const },
    take: 50,
    include: {
      changedBy: { select: { id: true, name: true, email: true } },
    },
  },
  taskRows: {
    select: {
      id: true,
      taskCode: true,
      plannedWorkDescription: true,
      status: true,
      percentComplete: true,
      section: {
        select: {
          report: {
            select: {
              id: true,
              reportDate: true,
              siteId: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" as const },
    take: 30,
  },
} satisfies Prisma.TicketInclude;

export type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

/** Eligible assignees for a site: active site members + active admins. */
export async function listAssignableUsers(siteId: string) {
  const [members, admins] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        memberships: { some: { siteId } },
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: "ADMIN" },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const byId = new Map<string, (typeof members)[number]>();
  for (const u of [...members, ...admins]) byId.set(u.id, u);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function assertAssigneesEligible(siteId: string, assigneeIds: string[]) {
  const eligible = await listAssignableUsers(siteId);
  const allowed = new Set(eligible.map((u) => u.id));
  const invalid = assigneeIds.filter((id) => !allowed.has(id));
  if (invalid.length > 0) {
    throw new HttpError(400, "One or more assignees are not eligible for this site");
  }
}

export function isAssignee(ticket: { assignees: Array<{ userId: string }> }, userId: string) {
  return ticket.assignees.some((a) => a.userId === userId);
}

/** Status transitions for shared assignees + raiser close. */
export function canTransitionStatus(opts: {
  from: TicketStatus;
  to: TicketStatus;
  userId: string;
  role: string;
  raisedById: string;
  assigneeIds: string[];
}): boolean {
  const { from, to, userId, role, raisedById, assigneeIds } = opts;
  if (from === to) return true;
  if (role === "ADMIN") return true;

  const assigned = assigneeIds.includes(userId);
  const isRaiser = userId === raisedById;

  // Assignees (and raiser) can move OPEN <-> IN_PROGRESS -> DONE
  if (assigned || isRaiser) {
    if (from === "OPEN" && (to === "IN_PROGRESS" || to === "DONE")) return true;
    if (from === "IN_PROGRESS" && (to === "OPEN" || to === "DONE")) return true;
    if (from === "DONE" && to === "IN_PROGRESS") return true;
  }

  // Only raiser (or admin above) closes after review
  if (isRaiser && from === "DONE" && to === "CLOSED") return true;
  // Raiser may reopen closed for revision
  if (isRaiser && from === "CLOSED" && (to === "OPEN" || to === "IN_PROGRESS" || to === "DONE")) {
    return true;
  }

  return false;
}

export async function getOpenTicketsForHomepages(opts: {
  userId: string;
  role: string;
  siteIds?: string[];
  take?: number;
}) {
  const take = opts.take ?? 8;
  const where: Prisma.TicketWhereInput = {
    deletedAt: null,
    status: { not: "CLOSED" },
  };

  if (opts.role === "ADMIN") {
    if (opts.siteIds?.length) where.siteId = { in: opts.siteIds };
  } else {
    const siteIds =
      opts.siteIds ??
      (
        await prisma.siteMembership.findMany({
          where: { userId: opts.userId },
          select: { siteId: true },
        })
      ).map((m) => m.siteId);

    where.AND = [
      { siteId: { in: siteIds } },
      {
        OR: [{ raisedById: opts.userId }, { assignees: { some: { userId: opts.userId } } }],
      },
    ];
  }

  return prisma.ticket.findMany({
    where,
    include: {
      site: { select: { id: true, code: true, name: true } },
      raisedBy: { select: { id: true, name: true } },
      assignees: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take,
  });
}
