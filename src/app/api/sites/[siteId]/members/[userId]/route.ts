import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, errorResponseBody } from "@/lib/auth-guards";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string; userId: string }> }
) {
  try {
    await requireAdmin();
    const { siteId, userId } = await params;
    await prisma.siteMembership.deleteMany({ where: { siteId, userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
