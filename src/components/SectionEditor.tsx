"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ResolvedFieldDefinition } from "@/lib/fields";
import { DynamicRowForm, type RowValues } from "@/components/DynamicRowForm";
import { StatusBadge } from "@/components/StatusBadge";

type EditableRow = RowValues & { id?: string; sortOrder: number; _localKey: string };

let localKeyCounter = 0;
function nextLocalKey() {
  localKeyCounter += 1;
  return `local-${Date.now()}-${localKeyCounter}`;
}

function emptyValueFor(field: ResolvedFieldDefinition): RowValues[string] {
  if (field.defaultValue != null) return field.defaultValue;
  if (field.fieldType === "MULTISELECT" || field.fieldType === "PHOTO") return [];
  if (field.fieldType === "BOOLEAN") return false;
  return null;
}

function toEditableRow(row: RowValues & { id?: string; sortOrder?: number }, index: number): EditableRow {
  return { ...row, sortOrder: row.sortOrder ?? index, _localKey: nextLocalKey() };
}

/** Non-destructive auto-fill, mirroring lib/calculations.ts server-side:
 * only fills a derived field when it is currently empty. */
function applyDerivedDefaults(
  row: EditableRow,
  sectionType: "WORK_PROGRAMME" | "LABOUR_DEPLOYMENT",
  standardShiftHours: number
): EditableRow {
  if (sectionType === "WORK_PROGRAMME") {
    const target = row.targetQty;
    const achieved = row.achievedQty;
    if ((row.percentComplete === null || row.percentComplete === undefined) &&
      typeof target === "number" && typeof achieved === "number" && target > 0) {
      return { ...row, percentComplete: achieved / target };
    }
  } else {
    const present = row.actualPresent;
    if ((row.totalManHours === null || row.totalManHours === undefined) && typeof present === "number") {
      return { ...row, totalManHours: present * standardShiftHours };
    }
  }
  return row;
}

function rowSummary(row: EditableRow, fields: ResolvedFieldDefinition[]): { title: string; subtitle: string } {
  const primary = fields[0];
  const secondary = fields.find((f) => f.fieldType === "TEXTAREA") ?? fields[1];
  const titleVal = primary ? row[primary.key] : null;
  const subtitleVal = secondary ? row[secondary.key] : null;
  return {
    title: (titleVal as string) || "Untitled row",
    subtitle: (subtitleVal as string) || "",
  };
}

export function SectionEditor({
  reportId,
  sectionType,
  sectionLabel,
  fields,
  initialRows,
  initialStatus,
  standardShiftHours,
  backHref,
}: {
  reportId: string;
  sectionType: "WORK_PROGRAMME" | "LABOUR_DEPLOYMENT";
  sectionLabel: string;
  fields: ResolvedFieldDefinition[];
  initialRows: (RowValues & { id?: string; sortOrder?: number })[];
  initialStatus: "DRAFT" | "SUBMITTED";
  standardShiftHours: number;
  backHref: string;
}) {
  const [rows, setRows] = useState<EditableRow[]>(() => initialRows.map(toEditableRow));
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const readOnly = status === "SUBMITTED";
  const draftUrl = `/api/reports/${reportId}/sections/${sectionType}/draft`;
  const submitUrl = `/api/reports/${reportId}/sections/${sectionType}/submit`;

  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const saveDraft = useCallback(async (): Promise<(RowValues & { id?: string })[] | null> => {
    if (readOnly) return null;
    setSaveState("saving");
    setErrorMessage(null);
    try {
      const payload = {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        rows: rowsRef.current.map(({ _localKey, ...rest }) => rest),
      };
      const res = await fetch(draftUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save draft");
      }
      const savedRows = data.rows as (RowValues & { id?: string })[];
      setRows(savedRows.map(toEditableRow));
      setSaveState("saved");
      return savedRows;
    } catch (err) {
      setSaveState("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to save draft");
      return null;
    }
  }, [draftUrl, readOnly]);

  // Debounced autosave (~2s after the last edit).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (readOnly) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      saveDraft();
    }, 2000);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, readOnly]);

  function updateRowField(index: number, key: string, value: RowValues[string]) {
    setRows((prev) => {
      const next = [...prev];
      const updated = { ...next[index], [key]: value };
      next[index] = applyDerivedDefaults(updated, sectionType, standardShiftHours);
      return next;
    });
  }

  function addRow() {
    const newRow: EditableRow = {
      sortOrder: rows.length,
      _localKey: nextLocalKey(),
    };
    for (const f of fields) {
      newRow[f.key] = emptyValueFor(f);
    }
    setRows((prev) => [...prev, newRow]);
    setExpandedIndex(rows.length);
  }

  function removeRow(index: number) {
    if (!confirm("Remove this row?")) return;
    setRows((prev) => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, sortOrder: i })));
    setExpandedIndex(null);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      // Flush any pending edits first so submit validates the latest data.
      await saveDraft();
      const res = await fetch(submitUrl, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Submission failed — check required fields");
      }
      setStatus("SUBMITTED");
      setConfirmingSubmit(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  const saveIndicator = useMemo(() => {
    switch (saveState) {
      case "saving":
        return "Saving…";
      case "saved":
        return "Saved";
      case "error":
        return "Save failed";
      default:
        return "";
    }
  }, [saveState]);

  return (
    <div className="flex min-h-screen flex-col pb-28">
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{sectionLabel}</h2>
          <StatusBadge value={status} />
        </div>

        {status === "SUBMITTED" && (
          <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
            This section has been submitted and is read-only. Ask an admin to reopen it to make
            changes.
          </div>
        )}

        {errorMessage && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {errorMessage}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No rows yet. {!readOnly && "Tap \u201cAdd row\u201d to start."}
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row, index) => {
              const expanded = expandedIndex === index;
              const { title, subtitle } = rowSummary(row, fields);
              return (
                <li key={row._localKey} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setExpandedIndex(expanded ? null : index)}
                    className="flex w-full min-h-14 items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">{title}</span>
                      {subtitle && <span className="block truncate text-sm text-slate-500">{subtitle}</span>}
                    </span>
                    <span className="shrink-0 text-slate-400">{expanded ? "▲" : "▼"}</span>
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-100 px-4 py-4">
                      <DynamicRowForm
                        fields={fields}
                        values={row}
                        onFieldChange={(key, value) => updateRowField(index, key, value)}
                        disabled={readOnly}
                        taskRowId={sectionType === "WORK_PROGRAMME" ? row.id : undefined}
                        onRequireRowSave={
                          sectionType === "WORK_PROGRAMME"
                            ? async () => {
                                if (row.id) return row.id;
                                const saved = await saveDraft();
                                return saved?.[index]?.id;
                              }
                            : undefined
                        }
                      />
                      {!readOnly && (
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="min-h-9 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                          >
                            Remove row
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!readOnly && (
          <button
            type="button"
            onClick={addRow}
            className="min-h-12 w-full rounded-lg border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-amber-400 hover:text-amber-700"
          >
            + Add row
          </button>
        )}

        <div className="pt-2">
          <Link href={backHref} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Back to report
          </Link>
        </div>
      </main>

      {!readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{saveIndicator}</span>

            {!confirmingSubmit ? (
              <>
                <button
                  type="button"
                  onClick={saveDraft}
                  className="min-h-11 shrink-0 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingSubmit(true)}
                  disabled={rows.length === 0}
                  className="min-h-11 shrink-0 rounded-md bg-amber-500 px-4 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
                >
                  Submit
                </button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                  Submit {sectionLabel}?
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmingSubmit(false)}
                  className="min-h-11 shrink-0 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="min-h-11 shrink-0 rounded-md bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Yes, submit"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
