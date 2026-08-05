import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSiteAccess, requireUser, errorResponseBody, HttpError } from "@/lib/auth-guards";

/**
 * Walks taskRow -> section -> report -> siteId and authorizes via
 * requireSiteAccess. Shared by GET/POST/DELETE so a task row's site can
 * never be spoofed by a client-supplied siteId.
 */
async function loadTaskRowWithSite(taskRowId: string) {
  const taskRow = await prisma.taskRow.findUnique({
    where: { id: taskRowId },
    include: { section: { include: { report: true } } },
  });
  if (!taskRow) throw new HttpError(404, "Task row not found");
  const siteId = taskRow.section.report.siteId;
  await requireSiteAccess(siteId);
  return taskRow;
}

/** GET /api/task-rows/[taskRowId]/attachments — list. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskRowId: string }> }
) {
  try {
    const { taskRowId } = await params;
    await loadTaskRowWithSite(taskRowId);
    const attachments = await prisma.attachment.findMany({
      where: { taskRowId },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ attachments });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

const linkSchema = z.object({
  url: z.string().min(1),
  storageKey: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
});

/**
 * POST /api/task-rows/[taskRowId]/attachments — link an already-uploaded
 * file (from POST /api/uploads) to this task row. Only allowed while the
 * row's section is DRAFT.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskRowId: string }> }
) {
  try {
    const { taskRowId } = await params;
    const taskRow = await loadTaskRowWithSite(taskRowId);
    const user = await requireUser();

    if (taskRow.section.status !== "DRAFT") {
      throw new HttpError(409, "Section is submitted; ask an admin to reopen it before adding photos");
    }

    const json = await req.json().catch(() => null);
    const parsed = linkSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid attachment payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const attachment = await prisma.attachment.create({
      data: {
        taskRowId,
        uploadedById: user.id,
        ...parsed.data,
      },
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
