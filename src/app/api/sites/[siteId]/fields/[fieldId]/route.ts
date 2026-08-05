import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { fieldUpdateSchema } from "@/lib/validation/adminSchemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string; fieldId: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { siteId, fieldId } = await params;
    const json = await req.json().catch(() => null);
    const parsed = fieldUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.fieldDefinition.findUnique({ where: { id: fieldId } });
    if (!existing) throw new HttpError(404, "Field not found");
    if (existing.siteId && existing.siteId !== siteId) {
      throw new HttpError(404, "Field not found for this site");
    }

    // Editing a global row creates a site override — never mutates the template.
    let field;
    if (existing.siteId === null) {
      field = await prisma.fieldDefinition.create({
        data: {
          siteId,
          sectionType: existing.sectionType,
          key: existing.key,
          label: data.label ?? existing.label,
          fieldType: data.fieldType ?? existing.fieldType,
          order: existing.order,
          isSystem: existing.isSystem,
          isRequired: data.isRequired ?? existing.isRequired,
          isActive: data.isActive ?? existing.isActive,
          options: data.options ?? existing.options,
          placeholder: data.placeholder !== undefined ? data.placeholder : existing.placeholder,
          helpText: data.helpText !== undefined ? data.helpText : existing.helpText,
          defaultValue: data.defaultValue !== undefined ? data.defaultValue : existing.defaultValue,
        },
      });
    } else {
      field = await prisma.fieldDefinition.update({
        where: { id: fieldId },
        data: {
          ...(data.label != null ? { label: data.label } : {}),
          ...(data.isRequired != null ? { isRequired: data.isRequired } : {}),
          ...(data.isActive != null ? { isActive: data.isActive } : {}),
          ...(data.options != null ? { options: data.options } : {}),
          ...(data.placeholder !== undefined ? { placeholder: data.placeholder } : {}),
          ...(data.helpText !== undefined ? { helpText: data.helpText } : {}),
          ...(data.defaultValue !== undefined ? { defaultValue: data.defaultValue } : {}),
          ...(data.fieldType != null && !existing.isSystem ? { fieldType: data.fieldType } : {}),
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "field.update",
        entityType: "FieldDefinition",
        entityId: field.id,
        metadata: { fromId: fieldId, siteId },
      },
    });

    return NextResponse.json({ field });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string; fieldId: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { siteId, fieldId } = await params;
    const existing = await prisma.fieldDefinition.findUnique({ where: { id: fieldId } });
    if (!existing || existing.siteId !== siteId) throw new HttpError(404, "Field not found");
    if (existing.isSystem) {
      throw new HttpError(400, "System fields cannot be deleted; hide it instead");
    }
    // Leave orphaned custom JSON keys on historical rows — do not rewrite history.
    await prisma.fieldDefinition.delete({ where: { id: fieldId } });
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "field.delete",
        entityType: "FieldDefinition",
        entityId: fieldId,
        metadata: { key: existing.key, siteId },
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
