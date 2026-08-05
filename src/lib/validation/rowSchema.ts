import { z, type ZodTypeAny } from "zod";
import type { ResolvedFieldDefinition } from "@/lib/fields";
import { isValidDateParam } from "@/lib/dates";

export type { RowValues } from "@/types/rows";

/**
 * Builds one field's Zod type from its FieldType. Draft mode is always
 * lenient (nullable/optional) regardless of `isRequired` — an in-progress
 * row must never fail to save. Submit mode enforces `isRequired`.
 */
function baseSchemaForField(field: ResolvedFieldDefinition): ZodTypeAny {
  switch (field.fieldType) {
    case "NUMBER":
    case "DECIMAL":
    case "PERCENT":
      return z.coerce.number({ invalid_type_error: `${field.label} must be a number` });
    case "BOOLEAN":
      // z.coerce.boolean() is a trap: it calls Boolean(value), so the string
      // "false" coerces to `true` (any non-empty string is truthy). Accept
      // real booleans plus the string forms a form/JSON payload might carry.
      return z
        .union([z.boolean(), z.string(), z.number()])
        .transform((v) => {
          if (typeof v === "boolean") return v;
          if (typeof v === "number") return v !== 0;
          return v.trim().toLowerCase() === "true" || v.trim() === "1";
        });
    case "DATE":
      return z
        .string()
        .refine((v) => isValidDateParam(v), { message: `${field.label} must be YYYY-MM-DD` });
    case "SELECT":
      return field.options.length > 0
        ? z.enum(field.options as [string, ...string[]])
        : z.string();
    case "MULTISELECT":
      return z.array(z.string()).default([]);
    case "PHOTO":
      // Attachment linking is handled by /api/task-rows/[id]/attachments (later
      // phase); a row payload only ever carries attachment ids here.
      return z.array(z.string()).default([]);
    case "TEXTAREA":
    case "TEXT":
    default:
      return z.string();
  }
}

function applyRequired(schema: ZodTypeAny, field: ResolvedFieldDefinition, mode: "draft" | "submit"): ZodTypeAny {
  const required = mode === "submit" && field.isRequired;
  if (!required) {
    return schema.nullable().optional();
  }
  if (schema instanceof z.ZodString) {
    return schema.min(1, `${field.label} is required`);
  }
  if (schema instanceof z.ZodArray) {
    return schema.min(1, `${field.label} is required`);
  }
  return schema;
}

/** One row's schema: system + custom field keys live at the same top level;
 * the caller (draft route) splits them by isSystem before hitting Prisma. */
export function buildRowSchema(
  fields: ResolvedFieldDefinition[],
  opts: { mode: "draft" | "submit" } = { mode: "draft" }
) {
  const shape: Record<string, ZodTypeAny> = {
    id: z.string().optional(),
    sortOrder: z.number().int().optional(),
  };

  for (const field of fields) {
    const base = baseSchemaForField(field);
    shape[field.key] = applyRequired(base, field, opts.mode);
  }

  return z.object(shape);
}

export function buildSectionRowsSchema(
  fields: ResolvedFieldDefinition[],
  opts: { mode: "draft" | "submit" } = { mode: "draft" }
) {
  return z.array(buildRowSchema(fields, opts));
}
