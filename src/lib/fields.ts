import type { FieldType, SectionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ResolvedFieldDefinition = {
  id: string;
  key: string;
  label: string;
  fieldType: FieldType;
  order: number;
  isSystem: boolean;
  isRequired: boolean;
  isActive: boolean;
  options: string[];
  placeholder: string | null;
  helpText: string | null;
  defaultValue: string | null;
};

/**
 * Effective field list for a site =
 *   site-specific rows  ∪  global rows whose key is not overridden,
 * filtered to active = true, sorted by order then key.
 *
 * This is the single source of truth for rendering, validation, and export
 * ordering. Every consumer (form renderer, API validator, Excel exporter)
 * must call this — never re-derive the merge logic inline.
 */
export async function getFieldDefinitions(
  siteId: string,
  sectionType: SectionType
): Promise<ResolvedFieldDefinition[]> {
  const [siteRows, globalRows] = await Promise.all([
    prisma.fieldDefinition.findMany({ where: { siteId, sectionType } }),
    prisma.fieldDefinition.findMany({ where: { siteId: null, sectionType } }),
  ]);

  const siteKeys = new Set(siteRows.map((r) => r.key));
  const merged = [
    ...siteRows,
    ...globalRows.filter((r) => !siteKeys.has(r.key)),
  ];

  return merged
    .filter((r) => r.isActive)
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
    .map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label,
      fieldType: r.fieldType,
      order: r.order,
      isSystem: r.isSystem,
      isRequired: r.isRequired,
      isActive: r.isActive,
      options: r.options,
      placeholder: r.placeholder,
      helpText: r.helpText,
      defaultValue: r.defaultValue,
    }));
}

export type AdminFieldDefinition = ResolvedFieldDefinition & {
  origin: "global" | "site";
  siteId: string | null;
};

/**
 * Same merge as getFieldDefinitions, but keeps inactive rows so the admin
 * field-config UI can un-hide them. Does not change the public renderer contract.
 */
export async function getFieldDefinitionsForAdmin(
  siteId: string,
  sectionType: SectionType
): Promise<AdminFieldDefinition[]> {
  const [siteRows, globalRows] = await Promise.all([
    prisma.fieldDefinition.findMany({ where: { siteId, sectionType } }),
    prisma.fieldDefinition.findMany({ where: { siteId: null, sectionType } }),
  ]);

  const siteKeys = new Set(siteRows.map((r) => r.key));
  const merged = [
    ...siteRows.map((r) => ({ ...r, origin: "site" as const })),
    ...globalRows
      .filter((r) => !siteKeys.has(r.key))
      .map((r) => ({ ...r, origin: "global" as const })),
  ];

  return merged
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
    .map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label,
      fieldType: r.fieldType,
      order: r.order,
      isSystem: r.isSystem,
      isRequired: r.isRequired,
      isActive: r.isActive,
      options: r.options,
      placeholder: r.placeholder,
      helpText: r.helpText,
      defaultValue: r.defaultValue,
      origin: r.origin,
      siteId: r.siteId,
    }));
}

/** Splits a system field from a custom (admin-added) field by key. */
export function splitSystemAndCustomKeys(
  fields: ResolvedFieldDefinition[]
): { systemKeys: Set<string>; customKeys: Set<string> } {
  const systemKeys = new Set<string>();
  const customKeys = new Set<string>();
  for (const f of fields) {
    (f.isSystem ? systemKeys : customKeys).add(f.key);
  }
  return { systemKeys, customKeys };
}
