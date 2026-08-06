import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireSiteAccess,
  requireAdmin,
  errorResponseBody,
  HttpError,
} from "@/lib/auth-guards";
import { updateTicketSchema } from "@/lib/validators/ticket";
import {
  assertAssigneesEligible,
  canTransitionStatus,
  isAssignee,
  ticketInclude,
} from "@/lib/tickets";

type Ctx = { params: Promise<{ id: string }> };

async function loadTicketOrThrow(id: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { id, deletedAt: null },
    include: {
      assignees: true,
    },
  });
  if (!ticket) throw new HttpError(404, "Ticket not found");
  return ticket;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const ticket = await prisma.ticket.findFirst({
      where: { id, deletedAt: null },
      include: ticketInclude,
    });
    if (!ticket) throw new HttpError(404, "Ticket not found");
    await requireSiteAccess(ticket.siteId);

    if (
      user.role !== "ADMIN" &&
      ticket.raisedById !== user.id &&
      !isAssignee(ticket, user.id)
    ) {
      // Site members can view tickets on their sites (homepage / link from DPR)
      // requireSiteAccess already passed — allow read for site members.
    }

    return NextResponse.json({ ticket });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const existing = await loadTicketOrThrow(id);
    await requireSiteAccess(existing.siteId);

    const json = await req.json().catch(() => null);
    const parsed = updateTicketSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const assigneeIds = existing.assignees.map((a) => a.userId);
    const isRaiser = existing.raisedById === user.id;
    const assigned = isAssignee(existing, user.id);
    const canEdit =
      user.role === "ADMIN" || isRaiser || assigned;

    if (!canEdit) throw new HttpError(403, "You cannot edit this ticket");

    if (data.status) {
      const ok = canTransitionStatus({
        from: existing.status,
        to: data.status,
        userId: user.id,
        role: user.role,
        raisedById: existing.raisedById,
        assigneeIds,
      });
      if (!ok) throw new HttpError(403, `Cannot move status from ${existing.status} to ${data.status}`);
    }

    if (data.assigneeIds) {
      if (user.role !== "ADMIN" && !isRaiser) {
        throw new HttpError(403, "Only the raiser or an admin can change assignees");
      }
      await assertAssigneesEligible(existing.siteId, data.assigneeIds);
    }

    const descriptionChanged =
      data.description !== undefined &&
      (data.description ?? null) !== (existing.description ?? null);

    if (descriptionChanged && user.role !== "ADMIN" && !isRaiser && !assigned) {
      throw new HttpError(403, "Cannot edit description");
    }

    const ticket = await prisma.$transaction(async (tx) => {
      if (data.assigneeIds) {
        await tx.ticketAssignee.deleteMany({ where: { ticketId: id } });
        await tx.ticketAssignee.createMany({
          data: data.assigneeIds.map((userId) => ({ ticketId: id, userId })),
        });
      }

      if (descriptionChanged) {
        await tx.ticketDescriptionLog.create({
          data: {
            ticketId: id,
            changedById: user.id,
            previousDescription: existing.description,
            newDescription: data.description ?? null,
          },
        });
      }

      const closing = data.status === "CLOSED" && existing.status !== "CLOSED";
      const reopening = existing.status === "CLOSED" && data.status && data.status !== "CLOSED";

      return tx.ticket.update({
        where: { id },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(closing
            ? { closedAt: new Date(), closedById: user.id }
            : reopening
              ? { closedAt: null, closedById: null }
              : {}),
        },
        include: ticketInclude,
      });
    });

    return NextResponse.json({ ticket });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

/** Soft-delete — admin only. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const existing = await prisma.ticket.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new HttpError(404, "Ticket not found");

    await prisma.ticket.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
