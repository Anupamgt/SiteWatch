import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { getFieldDefinitionsForAdmin } from "@/lib/fields";
import { fieldReorderSchema } from "@/lib/validation/adminSchemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { siteId } = await params;
    const json = await req.json().catch(() => null);
    const parsed = fieldReorderSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.issues }, { status: 400 });
    }
    const { sectionType, orderedKeys } = parsed.data;
    const resolved = await getFieldDefinitionsForAdmin(siteId, sectionType);
    const byKey = new Map(resolved.map((f) => [f.key, f]));

    await prisma.$transaction(async (tx) => {
      for (let order = 0; order < orderedKeys.length; order++) {
        const key = orderedKeys[order];
        const current = byKey.get(key);
        if (!current) continue;

        if (current.origin === "global") {
          await tx.fieldDefinition.create({
            data: {
              siteId,
              sectionType,
              key: current.key,
              label: current.label,
              fieldType: current.fieldType,
              order,
              isSystem: current.isSystem,
              isRequired: current.isRequired,
              isActive: current.isActive,
              options: current.options,
              placeholder: current.placeholder,
              helpText: current.helpText,
              defaultValue: current.defaultValue,
            },
          });
        } else {
          await tx.fieldDefinition.update({
            where: { id: current.id },
            data: { order },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "field.reorder",
          entityType: "FieldDefinition",
          entityId: siteId,
          metadata: { sectionType, orderedKeys },
        },
      });
    });

    const fields = await getFieldDefinitionsForAdmin(siteId, sectionType);
    return NextResponse.json({ fields });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    if (err instanceof HttpError) return NextResponse.json(body, { status });
    return NextResponse.json(body, { status });
  }
}
