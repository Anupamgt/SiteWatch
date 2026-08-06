import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteAccess, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { updateMachineSchema } from "@/lib/validators/machine";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.machine.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Machine not found");
    await requireSiteAccess(existing.siteId);

    const json = await req.json().catch(() => null);
    const parsed = updateMachineSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;
    if (data.siteId && data.siteId !== existing.siteId) {
      await requireSiteAccess(data.siteId);
    }

    const machine = await prisma.machine.update({
      where: { id },
      data: {
        ...(data.siteId !== undefined ? { siteId: data.siteId } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.ownership !== undefined ? { ownership: data.ownership } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.ownerLabel !== undefined ? { ownerLabel: data.ownerLabel } : {}),
        ...(data.registration !== undefined ? { registration: data.registration } : {}),
        ...(data.dailyRate !== undefined ? { dailyRate: data.dailyRate } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: {
        site: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({
      machine: {
        ...machine,
        dailyRate: machine.dailyRate == null ? null : Number(machine.dailyRate),
      },
    });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.machine.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Machine not found");
    await requireSiteAccess(existing.siteId);

    // Soft-deactivate so history stays on the dashboard register.
    await prisma.machine.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
