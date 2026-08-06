import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireSiteAccess, errorResponseBody } from "@/lib/auth-guards";
import { createMachineSchema } from "@/lib/validators/machine";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId");
    const includeInactive = searchParams.get("includeInactive") === "1";

    let siteFilter: { siteId?: string | { in: string[] } } = {};

    if (siteId) {
      await requireSiteAccess(siteId);
      siteFilter = { siteId };
    } else if (user.role === "ADMIN") {
      // portfolio-wide
    } else {
      const memberships = await prisma.siteMembership.findMany({
        where: { userId: user.id },
        select: { siteId: true },
      });
      siteFilter = { siteId: { in: memberships.map((m) => m.siteId) } };
    }

    const machines = await prisma.machine.findMany({
      where: {
        ...siteFilter,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        site: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({
      machines: machines.map((m) => ({
        ...m,
        dailyRate: m.dailyRate == null ? null : Number(m.dailyRate),
      })),
    });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const json = await req.json().catch(() => null);
    const parsed = createMachineSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;
    await requireSiteAccess(data.siteId);

    const machine = await prisma.machine.create({
      data: {
        siteId: data.siteId,
        name: data.name,
        category: data.category,
        ownership: data.ownership,
        status: data.status,
        ownerLabel: data.ownerLabel,
        registration: data.registration,
        dailyRate: data.dailyRate,
        notes: data.notes,
        isActive: data.isActive ?? true,
      },
      include: {
        site: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json(
      {
        machine: {
          ...machine,
          dailyRate: machine.dailyRate == null ? null : Number(machine.dailyRate),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
