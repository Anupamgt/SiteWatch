import { NextRequest, NextResponse } from "next/server";
import { SectionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, errorResponseBody, HttpError } from "@/lib/auth-guards";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string; type: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { reportId, type: rawType } = await params;
    if (rawType !== "WORK_PROGRAMME" && rawType !== "LABOUR_DEPLOYMENT") {
      throw new HttpError(400, "Invalid section type");
    }
    const type = rawType as SectionType;

    const section = await prisma.reportSection.findUnique({
      where: { reportId_type: { reportId, type } },
    });
    if (!section) throw new HttpError(404, "Section not found");

    const updated = await prisma.reportSection.update({
      where: { id: section.id },
      data: { status: "DRAFT", submittedAt: null, submittedById: null },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "section.reopen",
        entityType: "ReportSection",
        entityId: section.id,
        metadata: { type },
      },
    });

    return NextResponse.json({ section: updated });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
