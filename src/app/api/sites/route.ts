import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { siteCreateSchema } from "@/lib/validation/adminSchemas";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role === "ADMIN") {
      const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });
      return NextResponse.json({ sites });
    }
    const memberships = await prisma.siteMembership.findMany({
      where: { userId: user.id },
      include: { site: true },
    });
    return NextResponse.json({
      sites: memberships.map((m) => m.site).filter((s) => s.isActive),
    });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const json = await req.json().catch(() => null);
    const parsed = siteCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;
    const existing = await prisma.site.findUnique({ where: { code: data.code } });
    if (existing) throw new HttpError(409, `Site code ${data.code} already exists`);

    const site = await prisma.site.create({
      data: {
        code: data.code,
        name: data.name,
        projectName: data.projectName,
        locationZone: data.locationZone ?? null,
        contractorClient: data.contractorClient ?? null,
        standardShiftHours: data.standardShiftHours ?? 8,
        isActive: data.isActive ?? true,
      },
    });
    return NextResponse.json({ site }, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
