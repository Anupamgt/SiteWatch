import type { ResolvedFieldDefinition } from "@/lib/fields";
import type { RowValues } from "@/types/rows";

type RawRow = Record<string, unknown> & { id: string; sortOrder: number; custom?: unknown };

function normalizeValue(raw: unknown): unknown {
  if (
    raw !== null &&
    typeof raw === "object" &&
    "toNumber" in (raw as Record<string, unknown>) &&
    typeof (raw as { toNumber: unknown }).toNumber === "function"
  ) {
    // Prisma.Decimal instance
    return (raw as { toNumber: () => number }).toNumber();
  }
  return raw;
}

/** Turns a DB row (TaskRow | LabourRow) into a flat object keyed by
 * FieldDefinition.key — system columns and `custom` JSON entries alike —
 * ready for the dynamic form and for JSON transport. */
export function flattenRow(
  row: RawRow,
  fields: ResolvedFieldDefinition[]
): RowValues & { id: string; sortOrder: number } {
  const custom = (row.custom ?? {}) as Record<string, unknown>;
  const out: RowValues & { id: string; sortOrder: number } = {
    id: row.id,
    sortOrder: row.sortOrder,
  };
  for (const f of fields) {
    out[f.key] = f.isSystem
      ? (normalizeValue(row[f.key]) as RowValues[string])
      : ((custom[f.key] ?? null) as RowValues[string]);
  }
  return out;
}

/**
 * `TaskRow.status` and `LabourRow.productivityCheck` are non-nullable enum
 * columns with a Prisma `@default(...)`. `sortOrder` is a non-nullable Int
 * with `@default(0)` and is handled separately by the caller anyway. If the
 * engineer hasn't picked a value yet, we must OMIT the key from the update
 * payload (so the column keeps its existing value / default) rather than
 * write `null` into it — writing null throws a Prisma validation error and
 * kills autosave entirely.
 */
const NON_NULLABLE_SYSTEM_KEYS = new Set(["status", "productivityCheck", "sortOrder"]);

/** Splits a flat row payload back into { systemData, customData } for
 * persistence. `systemData` keys line up 1:1 with Prisma column names
 * because a system FieldDefinition.key IS the column name by convention. */
export function splitRowForPersistence(
  row: RowValues,
  fields: ResolvedFieldDefinition[]
): { systemData: Record<string, unknown>; customData: Record<string, unknown> } {
  const systemData: Record<string, unknown> = {};
  const customData: Record<string, unknown> = {};
  for (const f of fields) {
    const val = row[f.key];
    if (f.isSystem) {
      const isEmpty = val === undefined || val === null || val === "";
      if (isEmpty && NON_NULLABLE_SYSTEM_KEYS.has(f.key)) {
        // Omit entirely so the column's Prisma default / existing value applies.
        continue;
      }
      // An emptied text field ("") clears a nullable column to null rather
      // than persisting an empty string.
      systemData[f.key] = val === undefined || val === "" ? null : val;
    } else if (val !== undefined) {
      customData[f.key] = val;
    }
  }
  return { systemData, customData };
}
