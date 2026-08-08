"use client";

import type { ResolvedFieldDefinition } from "@/lib/fields";
import { DynamicField } from "@/components/DynamicField";
import type { RowValues } from "@/types/rows";

export type { RowValues } from "@/types/rows";

/**
 * Renders every field of a single row (system + custom, sorted by `order`
 * upstream). This is deliberately dumb: it has no autosave/network logic of
 * its own, so it can be reused for both Work Programme and Labour rows —
 * the field list is what differs, not the form mechanics.
 */
export function DynamicRowForm({
  fields,
  values,
  onFieldChange,
  disabled,
  taskRowId,
  onRequireRowSave,
}: {
  fields: ResolvedFieldDefinition[];
  values: RowValues;
  onFieldChange: (key: string, value: RowValues[string]) => void;
  disabled?: boolean;
  taskRowId?: string;
  onRequireRowSave?: () => Promise<string | undefined>;
}) {
  // Short forms (e.g. Labour Type + Bus Number) stay single-column for scanability.
  const multiColumn = fields.length > 2;

  return (
    <div className={`grid grid-cols-1 gap-4 ${multiColumn ? "sm:grid-cols-2" : ""}`}>
      {fields.map((field) => (
        <div
          key={field.key}
          className={
            multiColumn && (field.fieldType === "TEXTAREA" || field.fieldType === "PHOTO")
              ? "sm:col-span-2"
              : ""
          }
        >
          <DynamicField
            field={field}
            value={values[field.key]}
            onChange={(v) => onFieldChange(field.key, v)}
            disabled={disabled}
            taskRowId={field.fieldType === "PHOTO" ? taskRowId : undefined}
            onRequireRowSave={field.fieldType === "PHOTO" ? onRequireRowSave : undefined}
          />
        </div>
      ))}
    </div>
  );
}
