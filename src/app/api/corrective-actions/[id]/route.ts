import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { correctiveActionPatchSchema } from "@/lib/validation/adminSchemas";
import { parseDateOnly } from "@/lib/dates";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const action = await prisma.correctiveAction.findUnique({ where: { id } });
    if (!action) throw new HttpError(404, "Action not found");

    const json = await req.json().catch(() => null);
    const parsed = correctiveActionPatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    if (user.role !== "ADMIN") {
      if (action.assignedToId !== user.id) throw new HttpError(403, "Not your action");
      if (data.status === "CLOSED") throw new HttpError(403, "Only an admin can close an action");
      if (data.status && data.status !== "IN_PROGRESS" && data.status !== "OPEN") {
        throw new HttpError(403, "Engineers may only move to IN_PROGRESS");
      }
      // Engineers: OPEN → IN_PROGRESS and optional closureNote proposal
      const updated = await prisma.correctiveAction.update({
        where: { id },
        data: {
          ...(data.status ? { status: data.status } : {}),
          ...(data.closureNote !== undefined ? { closureNote: data.closureNote } : {}),
        },
      });
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "action.update",
          entityType: "CorrectiveAction",
          entityId: id,
          metadata: data,
        },
      });
      return NextResponse.json({ action: updated });
    }

    await requireAdmin();
    const updated = await prisma.correctiveAction.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.closureNote !== undefined ? { closureNote: data.closureNote } : {}),
        ...(data.guidance !== undefined ? { guidance: data.guidance } : {}),
        ...(data.priority ? { priority: data.priority } : {}),
        ...(data.dueDate !== undefined
          ? { dueDate: data.dueDate ? parseDateOnly(data.dueDate) : null }
          : {}),
        ...(data.status === "CLOSED"
          ? { closedAt: new Date(), closedById: user.id }
          : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: data.status === "CLOSED" ? "action.close" : "action.update",
        entityType: "CorrectiveAction",
        entityId: id,
        metadata: data,
      },
    });

    return NextResponse.json({ action: updated });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
