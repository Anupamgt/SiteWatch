import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { memberSchema } from "@/lib/validation/adminSchemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    await requireAdmin();
    const { siteId } = await params;
    const members = await prisma.siteMembership.findMany({
      where: { siteId },
      include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true, phone: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ members });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    await requireAdmin();
    const { siteId } = await params;
    const json = await req.json().catch(() => null);
    const parsed = memberSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.issues }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
    if (!user) throw new HttpError(404, "User not found");

    const membership = await prisma.siteMembership.upsert({
      where: { userId_siteId: { userId: parsed.data.userId, siteId } },
      create: { userId: parsed.data.userId, siteId },
      update: {},
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    return NextResponse.json({ membership }, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
