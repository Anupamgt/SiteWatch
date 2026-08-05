import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { formatDateOnly } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { correctiveActionEmail } from "@/lib/email/templates/correctiveAction";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const action = await prisma.correctiveAction.findUnique({
      where: { id },
      include: {
        assignedTo: true,
        site: true,
        taskRow: true,
        report: true,
      },
    });
    if (!action) throw new HttpError(404, "Action not found");

    const deepLink = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/my/corrective-actions`;
    const template = correctiveActionEmail({
      siteName: action.site.name,
      reportDate: action.report ? formatDateOnly(action.report.reportDate) : null,
      taskCode: action.taskRow?.taskCode ?? null,
      plannedWork: action.taskRow?.plannedWorkDescription ?? null,
      title: action.title,
      guidance: action.guidance,
      priority: action.priority,
      dueDate: action.dueDate ? formatDateOnly(action.dueDate) : null,
      deepLink,
    });

    const sendResult = await sendEmail({
      to: action.assignedTo.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    const emailLog = await prisma.emailLog.create({
      data: {
        correctiveActionId: action.id,
        to: action.assignedTo.email,
        subject: template.subject,
        provider: sendResult.provider,
        status: sendResult.error ? "FAILED" : "SENT",
        providerMessageId: sendResult.messageId ?? null,
        error: sendResult.error ?? null,
        sentAt: sendResult.error ? null : new Date(),
      },
    });

    return NextResponse.json({ email: emailLog });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
