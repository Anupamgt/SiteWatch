import { NextRequest, NextResponse } from "next/server";
import type { SectionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { getFieldDefinitions, getFieldDefinitionsForAdmin } from "@/lib/fields";
import { fieldCreateSchema } from "@/lib/validation/adminSchemas";
import { invalidateFieldDefsCache } from "@/lib/cache";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    await requireAdmin();
    const { siteId } = await params;
    const sectionType = req.nextUrl.searchParams.get("sectionType") as SectionType | null;
    if (sectionType !== "WORK_PROGRAMME" && sectionType !== "LABOUR_DEPLOYMENT") {
      throw new HttpError(400, "sectionType query required");
    }
    const admin = req.nextUrl.searchParams.get("admin") === "1";
    const fields = admin
      ? await getFieldDefinitionsForAdmin(siteId, sectionType)
      : await getFieldDefinitions(siteId, sectionType);
    return NextResponse.json({ fields });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { siteId } = await params;
    const json = await req.json().catch(() => null);
    const parsed = fieldCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const systemClash = await prisma.fieldDefinition.findFirst({
      where: {
        sectionType: data.sectionType,
        key: data.key,
        isSystem: true,
        OR: [{ siteId: null }, { siteId }],
      },
    });
    if (systemClash) throw new HttpError(409, "Key collides with a system field");

    const existing = await prisma.fieldDefinition.findFirst({
      where: { siteId, sectionType: data.sectionType, key: data.key },
    });
    if (existing) throw new HttpError(409, "Field key already exists for this site");

    const maxOrder = await prisma.fieldDefinition.findFirst({
      where: { OR: [{ siteId }, { siteId: null }], sectionType: data.sectionType },
      orderBy: { order: "desc" },
    });

    const field = await prisma.fieldDefinition.create({
      data: {
        siteId,
        sectionType: data.sectionType,
        key: data.key,
        label: data.label,
        fieldType: data.fieldType,
        isSystem: false,
        isRequired: data.isRequired ?? false,
        options: data.options ?? [],
        placeholder: data.placeholder ?? null,
        helpText: data.helpText ?? null,
        defaultValue: data.defaultValue ?? null,
        order: (maxOrder?.order ?? 0) + 1,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "field.create",
        entityType: "FieldDefinition",
        entityId: field.id,
        metadata: { key: field.key, siteId },
      },
    });

    await invalidateFieldDefsCache(siteId);
    return NextResponse.json({ field }, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
