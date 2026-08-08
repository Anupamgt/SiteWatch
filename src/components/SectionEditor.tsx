"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ResolvedFieldDefinition } from "@/lib/fields";
import { DynamicRowForm, type RowValues } from "@/components/DynamicRowForm";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n } from "@/components/i18n/I18nProvider";

type EditableRow = RowValues & {
  id?: string;
  sortOrder: number;
  ticketId?: string | null;
  _localKey: string;
};

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

function rowSummary(
  row: EditableRow,
  fields: ResolvedFieldDefinition[],
  untitledLabel: string,
): { title: string; subtitle: string; hasCount: boolean } {
  const primary = fields[0];
  const secondary = fields.find((f) => f.fieldType === "TEXTAREA") ?? fields[1];
  const titleVal = primary ? row[primary.key] : null;
  const subtitleVal = secondary ? row[secondary.key] : null;
  let subtitle = "";
  let hasCount = false;
  if (subtitleVal !== null && subtitleVal !== undefined && subtitleVal !== "") {
    if (secondary?.key === "actualPresent" || secondary?.label === "Bus Number") {
      subtitle = `${subtitleVal} on site`;
      hasCount = true;
    } else {
      subtitle = String(subtitleVal);
    }
  }
  return {
    title: (titleVal as string) || untitledLabel,
    subtitle,
    hasCount,
  };
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden
      className={`shrink-0 text-[var(--ads-text-subtlest)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
    >
      <path
        fill="currentColor"
        d="M8.75 11.2a1 1 0 0 1-1.5 0L3.2 6.4A.75.75 0 0 1 3.75 5.2h8.5a.75.75 0 0 1 .55 1.2l-4.05 4.8Z"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden className="mt-0.5 shrink-0 text-[var(--ads-information)]">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm0 4.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM13 17h-2v-6h2v6Z"
      />
    </svg>
  );
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
  siteId,
  ticketOptions = [],
}: {
  reportId: string;
  sectionType: "WORK_PROGRAMME" | "LABOUR_DEPLOYMENT";
  sectionLabel: string;
  fields: ResolvedFieldDefinition[];
  initialRows: (RowValues & { id?: string; sortOrder?: number; ticketId?: string | null })[];
  initialStatus: "DRAFT" | "SUBMITTED";
  standardShiftHours: number;
  backHref: string;
  siteId?: string;
  ticketOptions?: Array<{ id: string; title: string; status: string }>;
}) {
  const { t, ticketStatus } = useI18n();
  const [rows, setRows] = useState<EditableRow[]>(() => initialRows.map(toEditableRow));
  // Labour Deployment opens with the first pre-filled trade expanded so the
  // engineer can enter the on-site labour count (Bus Number) immediately.
  const [expandedIndex, setExpandedIndex] = useState<number | null>(() =>
    sectionType === "LABOUR_DEPLOYMENT" && initialRows.length > 0 ? 0 : null,
  );
  const [status, setStatus] = useState(initialStatus);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const readOnly = status === "SUBMITTED";
  const draftUrl = `/api/reports/${reportId}/sections/${sectionType}/draft`;
  const submitUrl = `/api/reports/${reportId}/sections/${sectionType}/submit`;
  const isLabour = sectionType === "LABOUR_DEPLOYMENT";

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

  const addCtaLabel =
    sectionType === "WORK_PROGRAMME" ? t("section.addWork") : t("section.addLabour");
  const addPanelTitle =
    sectionType === "WORK_PROGRAMME" ? t("section.enterWork") : t("section.enterLabour");

  function addRow() {
    const newRow: EditableRow = {
      sortOrder: rows.length,
      _localKey: nextLocalKey(),
    };
    for (const f of fields) {
      newRow[f.key] = emptyValueFor(f);
    }
    const nextIndex = rows.length;
    setRows((prev) => [...prev, newRow]);
    setExpandedIndex(nextIndex);
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
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const payloadRows = rowsRef.current.map(({ _localKey, ...rest }) => rest);
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payloadRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Submission failed — check required fields");
      }
      if (Array.isArray(data.rows)) {
        setRows(data.rows.map(toEditableRow));
      }
      setStatus("SUBMITTED");
      setConfirmingSubmit(false);
      setSaveState("saved");
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
        return "All changes saved";
      case "error":
        return "Save failed";
      default:
        return "";
    }
  }, [saveState]);

  const filledCount = useMemo(() => {
    if (!isLabour) return rows.length;
    return rows.filter((r) => typeof r.actualPresent === "number").length;
  }, [isLabour, rows]);

  return (
    <div className="flex min-h-screen flex-col pb-28">
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ads-text)]">
              {sectionLabel}
            </h2>
            {isLabour && !readOnly && (
              <p className="mt-1 text-sm text-[var(--ads-text-subtle)]">
                {filledCount} of {rows.length} trades have a Bus Number
              </p>
            )}
          </div>
          <StatusBadge value={status} />
        </div>

        {status === "SUBMITTED" && (
          <div className="ads-flag ads-flag-success p-3 pr-4">
            <div className="min-w-0 text-sm text-[var(--ads-text)]">
              <p className="font-semibold">Submitted</p>
              <p className="mt-0.5 text-[var(--ads-text-subtle)]">
                This section is read-only. Ask an admin to reopen it to make changes.
              </p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="ads-flag ads-flag-error p-3 pr-4" role="alert">
            <div className="min-w-0 text-sm text-[var(--ads-text)]">
              <p className="font-semibold">Couldn’t save</p>
              <p className="mt-0.5 text-[var(--ads-text-subtle)]">{errorMessage}</p>
            </div>
          </div>
        )}

        {!readOnly && isLabour && (
          <div className="ads-flag p-3 pr-4">
            <InfoIcon />
            <div className="min-w-0 text-sm text-[var(--ads-text)]">
              <p className="font-semibold">Quick entry</p>
              <p className="mt-0.5 text-[var(--ads-text-subtle)]">
                Labour types are pre-filled. Open a row, enter the Bus Number (how many labour of
                that type are on site), then submit. Remove any types not on site today.
              </p>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="ads-surface px-6 py-10 text-center">
            <p className="text-sm font-medium text-[var(--ads-text)]">No entries yet</p>
            <p className="mt-1 text-sm text-[var(--ads-text-subtle)]">
              {!readOnly ? (
                <>
                  Use <span className="font-medium text-[var(--ads-text)]">{addCtaLabel}</span> to
                  add the first row.
                </>
              ) : (
                "Nothing was recorded for this section."
              )}
            </p>
            {!readOnly && (
              <button type="button" onClick={addRow} className="ads-btn ads-btn-primary mt-4">
                {addCtaLabel}
              </button>
            )}
          </div>
        ) : (
          <div className="ads-surface overflow-hidden">
            <ul className="divide-y divide-[var(--ads-border)]">
              {rows.map((row, index) => {
                const expanded = expandedIndex === index;
                const { title, subtitle, hasCount } = rowSummary(
                  row,
                  fields,
                  t("section.untitledRow"),
                );
                return (
                  <li
                    key={row._localKey}
                    className={expanded ? "bg-[var(--ads-surface-sunken)]" : "bg-[var(--ads-surface)]"}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedIndex(expanded ? null : index)}
                      className="flex w-full min-h-14 items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--ads-neutral)]"
                      aria-expanded={expanded}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ads-radius)] text-xs font-bold ${
                            hasCount
                              ? "bg-[#e9f2ff] text-[var(--ads-brand-hovered)]"
                              : "bg-[var(--ads-neutral)] text-[var(--ads-text-subtle)]"
                          }`}
                          aria-hidden
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-medium text-[var(--ads-text)]">
                            {title}
                          </span>
                          {subtitle ? (
                            <span className="mt-0.5 block truncate text-sm text-[var(--ads-text-subtle)]">
                              {subtitle}
                            </span>
                          ) : (
                            !readOnly &&
                            isLabour && (
                              <span className="mt-0.5 block truncate text-sm text-[var(--ads-text-subtlest)]">
                                Bus Number not entered
                              </span>
                            )
                          )}
                        </span>
                      </span>
                      <Chevron open={expanded} />
                    </button>

                    {expanded && (
                      <div className="border-t border-[var(--ads-border)] bg-[var(--ads-surface)] px-4 py-4">
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-[var(--ads-text)]">
                            {addPanelTitle}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-[var(--ads-text-subtlest)]">
                            {isLabour
                              ? "Confirm labour type and enter Bus Number (count of labour on site). Required fields are marked with *."
                              : "Complete each field below. Required fields are marked with *."}
                          </p>
                        </div>
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
                        {sectionType === "WORK_PROGRAMME" && siteId && (
                          <label className="mt-4 block">
                            <span className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-wide text-[var(--ads-text-subtle)]">
                              {t("tickets.linkToTicket")}
                            </span>
                            <select
                              value={row.ticketId ?? ""}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateRowField(index, "ticketId", e.target.value || null)
                              }
                              className="ads-input"
                            >
                              <option value="">{t("tickets.linkNone")}</option>
                              {ticketOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.title} ({ticketStatus(opt.status)})
                                </option>
                              ))}
                              {row.ticketId &&
                                !ticketOptions.some((opt) => opt.id === row.ticketId) && (
                                  <option value={row.ticketId}>{t("tickets.linkOther")}</option>
                                )}
                            </select>
                            <span className="mt-1.5 block text-xs leading-relaxed text-[var(--ads-text-subtlest)]">
                              {t("tickets.linkToTicketHelp")}
                            </span>
                          </label>
                        )}
                        {!readOnly && (
                          <div className="mt-4 flex justify-end border-t border-[var(--ads-border)] pt-3">
                            <button
                              type="button"
                              onClick={() => removeRow(index)}
                              className="ads-btn ads-btn-danger"
                            >
                              {t("section.removeRow")}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {!readOnly && (
              <div className="border-t border-[var(--ads-border)] bg-[var(--ads-surface-sunken)] px-3 py-2">
                <button
                  type="button"
                  onClick={addRow}
                  className="ads-btn ads-btn-subtle w-full justify-start font-medium text-[var(--ads-brand)] hover:text-[var(--ads-brand-hovered)]"
                >
                  {addCtaLabel.startsWith("+") ? (
                    addCtaLabel
                  ) : (
                    <>
                      <span aria-hidden className="text-lg leading-none">
                        +
                      </span>
                      {addCtaLabel}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="pt-1">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--ads-brand)] hover:text-[var(--ads-brand-hovered)] hover:underline"
          >
            ← {t("section.backToReport").replace(/^←\s*/, "")}
          </Link>
        </div>
      </main>

      {!readOnly && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--ads-border)] bg-[var(--ads-surface)] px-4 py-3"
          style={{ boxShadow: "var(--ads-shadow-overlay)" }}
        >
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <span
              className={`min-w-0 flex-1 truncate text-xs ${
                saveState === "error"
                  ? "text-[var(--ads-danger)]"
                  : saveState === "saved"
                    ? "text-[var(--ads-success-bold)]"
                    : "text-[var(--ads-text-subtlest)]"
              }`}
            >
              {saveIndicator}
            </span>

            {!confirmingSubmit ? (
              <>
                <button type="button" onClick={saveDraft} className="ads-btn ads-btn-default shrink-0">
                  {t("section.saveDraft")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingSubmit(true)}
                  disabled={rows.length === 0}
                  className="ads-btn ads-btn-primary shrink-0 px-5"
                >
                  {t("section.submit")}
                </button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ads-text)]">
                  {t("section.confirmSubmit")}
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmingSubmit(false)}
                  className="ads-btn ads-btn-default shrink-0"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="ads-btn ads-btn-primary shrink-0 px-5"
                >
                  {submitting ? t("section.submitting") : t("section.yesSubmit")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
