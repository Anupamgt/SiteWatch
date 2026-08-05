/**
 * Canonical row-value types shared by the field engine, the row-persistence
 * helpers, the dynamic form components, and the API validators. Previously
 * `RowValues` was defined separately (and incompatibly) in
 * `lib/validation/rowSchema.ts` and `components/DynamicRowForm.tsx`; this is
 * the single source of truth now. Both modules re-export from here so the
 * diff of switching call sites stays small.
 */
export type FieldValue = string | number | boolean | string[] | null | undefined;

export type RowValues = Record<string, FieldValue>;

export type EditableRow = RowValues & { id?: string; sortOrder?: number };
