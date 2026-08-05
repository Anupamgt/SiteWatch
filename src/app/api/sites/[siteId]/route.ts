import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSiteAccess, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { siteUpdateSchema } from "@/lib/validation/adminSchemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;
    await requireSiteAccess(siteId);
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new HttpError(404, "Site not found");
    return NextResponse.json({ site });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    await requireAdmin();
    const { siteId } = await params;
    const json = await req.json().catch(() => null);
    const parsed = siteUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;
    if (data.code) {
      const clash = await prisma.site.findFirst({
        where: { code: data.code, NOT: { id: siteId } },
      });
      if (clash) throw new HttpError(409, `Site code ${data.code} already exists`);
    }
    // Intentionally does NOT touch historical Report header snapshots (I9).
    const site = await prisma.site.update({
      where: { id: siteId },
      data: {
        ...(data.code != null ? { code: data.code } : {}),
        ...(data.name != null ? { name: data.name } : {}),
        ...(data.projectName != null ? { projectName: data.projectName } : {}),
        ...(data.locationZone !== undefined ? { locationZone: data.locationZone } : {}),
        ...(data.contractorClient !== undefined ? { contractorClient: data.contractorClient } : {}),
        ...(data.standardShiftHours != null ? { standardShiftHours: data.standardShiftHours } : {}),
        ...(data.isActive != null ? { isActive: data.isActive } : {}),
      },
    });
    return NextResponse.json({ site });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    await requireAdmin();
    const { siteId } = await params;
    const site = await prisma.site.update({
      where: { id: siteId },
      data: { isActive: false },
    });
    return NextResponse.json({ site });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
