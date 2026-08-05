import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { userUpdateSchema } from "@/lib/validation/adminSchemas";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  phone: true,
  isActive: true,
  createdAt: true,
  memberships: {
    select: { siteId: true, site: { select: { id: true, code: true, name: true } } },
  },
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin();
    const { userId } = await params;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
    if (!user) throw new HttpError(404, "User not found");
    return NextResponse.json({ user });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { userId } = await params;
    const json = await req.json().catch(() => null);
    const parsed = userUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new HttpError(404, "User not found");

    if (data.email && data.email !== existing.email) {
      const clash = await prisma.user.findUnique({ where: { email: data.email } });
      if (clash) throw new HttpError(409, "A user with this email already exists");
    }

    let passwordHash: string | null | undefined = undefined;
    if (data.password === null) {
      passwordHash = null; // clear local password → Google-only
    } else if (typeof data.password === "string" && data.password.length > 0) {
      passwordHash = await bcrypt.hash(data.password, 12);
    }

    const user = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(data.email != null ? { email: data.email } : {}),
          ...(data.name != null ? { name: data.name } : {}),
          ...(data.role != null ? { role: data.role } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.isActive != null ? { isActive: data.isActive } : {}),
          ...(passwordHash !== undefined ? { passwordHash } : {}),
        },
      });

      if (data.siteIds) {
        await tx.siteMembership.deleteMany({ where: { userId } });
        if (data.siteIds.length) {
          await tx.siteMembership.createMany({
            data: data.siteIds.map((siteId) => ({ userId, siteId })),
            skipDuplicates: true,
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "user.update",
          entityType: "User",
          entityId: userId,
          metadata: { fields: Object.keys(data) },
        },
      });

      return tx.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
    });

    return NextResponse.json({ user });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { userId } = await params;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: userSelect,
    });
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "user.deactivate",
        entityType: "User",
        entityId: userId,
        metadata: {},
      },
    });
    return NextResponse.json({ user });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
