import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireSiteAccess,
  errorResponseBody,
} from "@/lib/auth-guards";
import { createTicketSchema } from "@/lib/validators/ticket";
import {
  assertAssigneesEligible,
  ticketInclude,
} from "@/lib/tickets";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const siteId = sp.get("siteId") || undefined;
    const status = sp.get("status") || undefined;
    const includeClosed = sp.get("includeClosed") === "1";
    const mine = sp.get("mine") === "1";

    if (siteId) await requireSiteAccess(siteId);

    const where: Prisma.TicketWhereInput = {
      deletedAt: null,
      ...(siteId ? { siteId } : {}),
      ...(status
        ? { status: status as "OPEN" | "IN_PROGRESS" | "DONE" | "CLOSED" }
        : includeClosed
          ? {}
          : { status: { not: "CLOSED" } }),
    };

    if (user.role !== "ADMIN") {
      const memberships = await prisma.siteMembership.findMany({
        where: { userId: user.id },
        select: { siteId: true },
      });
      const siteIds = memberships.map((m) => m.siteId);
      where.siteId = siteId ? siteId : { in: siteIds };
      where.OR = [{ raisedById: user.id }, { assignees: { some: { userId: user.id } } }];
    } else if (mine) {
      where.OR = [{ raisedById: user.id }, { assignees: { some: { userId: user.id } } }];
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: ticketInclude,
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
    });

    return NextResponse.json({ tickets });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const json = await req.json().catch(() => null);
    const parsed = createTicketSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;
    await requireSiteAccess(data.siteId);
    await assertAssigneesEligible(data.siteId, data.assigneeIds);

    const ticket = await prisma.ticket.create({
      data: {
        siteId: data.siteId,
        title: data.title,
        description: data.description,
        raisedById: user.id,
        assignees: {
          create: data.assigneeIds.map((userId) => ({ userId })),
        },
        ...(data.description
          ? {
              descriptionLogs: {
                create: {
                  changedById: user.id,
                  previousDescription: null,
                  newDescription: data.description,
                },
              },
            }
          : {}),
      },
      include: ticketInclude,
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
