import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { userCreateSchema } from "@/lib/validation/adminSchemas";

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

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: userSelect,
    });
    return NextResponse.json({ users });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => null);
    const parsed = userCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new HttpError(409, "A user with this email already exists");

    // Google-only users may omit password; credentials login needs a hash.
    const passwordHash = data.password
      ? await bcrypt.hash(data.password, 12)
      : null;

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          role: data.role,
          phone: data.phone ?? null,
          passwordHash,
          isActive: data.isActive ?? true,
        },
        select: userSelect,
      });

      if (data.siteIds?.length) {
        await tx.siteMembership.createMany({
          data: data.siteIds.map((siteId) => ({ userId: created.id, siteId })),
          skipDuplicates: true,
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "user.create",
          entityType: "User",
          entityId: created.id,
          metadata: { email: created.email, role: created.role },
        },
      });

      return tx.user.findUniqueOrThrow({ where: { id: created.id }, select: userSelect });
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
