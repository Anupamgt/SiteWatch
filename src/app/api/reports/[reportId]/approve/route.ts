import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, errorResponseBody, HttpError } from "@/lib/auth-guards";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { reportId } = await params;
    const existing = await prisma.report.findUnique({ where: { id: reportId } });
    if (!existing) throw new HttpError(404, "Report not found");

    const report = await prisma.report.update({
      where: { id: reportId },
      data: { approvedById: actor.id, approvedAt: new Date() },
      include: { approvedBy: { select: { id: true, name: true } } },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "report.approve",
        entityType: "Report",
        entityId: reportId,
        metadata: {},
      },
    });

    return NextResponse.json({ report });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
