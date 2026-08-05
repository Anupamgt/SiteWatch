import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { correctiveActionCreateSchema } from "@/lib/validation/adminSchemas";
import { parseDateOnly, formatDateOnly, startOfTodayInAppTimezone } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { correctiveActionEmail } from "@/lib/email/templates/correctiveAction";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const siteId = sp.get("siteId") || undefined;
    const status = sp.get("status") || undefined;
    const overdueOnly = sp.get("overdue") === "true";
    let assignedToId = sp.get("assignedToId") || undefined;

    if (user.role !== "ADMIN") {
      assignedToId = user.id;
    }

    const today = startOfTodayInAppTimezone();
    const actions = await prisma.correctiveAction.findMany({
      where: {
        ...(siteId ? { siteId } : {}),
        ...(status ? { status: status as "OPEN" | "IN_PROGRESS" | "CLOSED" } : {}),
        ...(assignedToId ? { assignedToId } : {}),
        ...(overdueOnly
          ? { status: { not: "CLOSED" }, dueDate: { lt: today } }
          : {}),
      },
      include: {
        site: { select: { id: true, code: true, name: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        emails: { orderBy: { createdAt: "desc" }, take: 1 },
        taskRow: { select: { taskCode: true, plannedWorkDescription: true } },
        report: { select: { reportDate: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      actions: actions.map((a) => ({
        ...a,
        overdue:
          a.status !== "CLOSED" && a.dueDate != null && a.dueDate.getTime() < today.getTime(),
      })),
    });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => null);
    const parsed = correctiveActionCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
    if (!assignee || assignee.role !== "ENGINEER" || !assignee.isActive) {
      throw new HttpError(403, "Assignee must be an active engineer");
    }
    const membership = await prisma.siteMembership.findUnique({
      where: { userId_siteId: { userId: data.assignedToId, siteId: data.siteId } },
    });
    if (!membership) {
      throw new HttpError(403, "Assignee must be a member of the site");
    }

    const site = await prisma.site.findUniqueOrThrow({ where: { id: data.siteId } });
    let taskCode: string | null = null;
    let plannedWork: string | null = null;
    let reportDate: string | null = null;

    if (data.taskRowId) {
      const task = await prisma.taskRow.findUnique({ where: { id: data.taskRowId } });
      taskCode = task?.taskCode ?? null;
      plannedWork = task?.plannedWorkDescription ?? null;
    }
    if (data.reportId) {
      const report = await prisma.report.findUnique({ where: { id: data.reportId } });
      if (report) reportDate = formatDateOnly(report.reportDate);
    }

    const action = await prisma.correctiveAction.create({
      data: {
        siteId: data.siteId,
        reportId: data.reportId ?? null,
        taskRowId: data.taskRowId ?? null,
        title: data.title,
        description: data.description ?? null,
        guidance: data.guidance ?? null,
        priority: data.priority ?? "MEDIUM",
        dueDate: data.dueDate ? parseDateOnly(data.dueDate) : null,
        assignedToId: data.assignedToId,
        createdById: actor.id,
        status: "OPEN",
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        site: { select: { id: true, code: true, name: true } },
      },
    });

    const deepLink = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/my/corrective-actions`;
    const template = correctiveActionEmail({
      siteName: site.name,
      reportDate,
      taskCode,
      plannedWork,
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

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "action.create",
        entityType: "CorrectiveAction",
        entityId: action.id,
        metadata: {},
      },
    });

    // Always 201 even when email fails (I5).
    return NextResponse.json(
      {
        action,
        email: {
          status: emailLog.status,
          error: emailLog.error,
          id: emailLog.id,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
