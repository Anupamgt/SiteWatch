"use client";

import type { ResolvedFieldDefinition } from "@/lib/fields";
import type { FieldValue } from "@/types/rows";
import { PhotoStrip } from "@/components/PhotoStrip";

type Value = FieldValue;

export function DynamicField({
  field,
  value,
  onChange,
  disabled,
  taskRowId,
  onRequireRowSave,
}: {
  field: ResolvedFieldDefinition;
  value: Value;
  onChange: (value: Value) => void;
  disabled?: boolean;
  /** Only meaningful for PHOTO fields on Work Programme rows: the persisted
   * TaskRow id (undefined until the row has been saved at least once). */
  taskRowId?: string;
  /** Called by the PHOTO field when it needs the row flushed to the server
   * before it can attach a photo (a row must exist before it can hold
   * Attachments). Returns the persisted row id. */
  onRequireRowSave?: () => Promise<string | undefined>;
}) {
  const inputBaseClass = "ads-input text-[15px]";

  const label = (
    <label className="mb-1.5 flex items-baseline justify-between text-[0.75rem] font-semibold uppercase tracking-wide text-[var(--ads-text-subtle)]">
      <span>
        {field.label}
        {field.isRequired && (
          <span className="ml-0.5 text-[var(--ads-danger)]" aria-hidden>
            *
          </span>
        )}
      </span>
    </label>
  );

  const help = field.helpText ? (
    <p className="mt-1.5 text-xs leading-relaxed text-[var(--ads-text-subtlest)]">{field.helpText}</p>
  ) : null;

  switch (field.fieldType) {
    case "TEXTAREA":
      return (
        <div>
          {label}
          <textarea
            className={`${inputBaseClass} min-h-20`}
            placeholder={field.placeholder ?? undefined}
            value={(value as string) ?? ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
          />
          {help}
        </div>
      );

    case "NUMBER":
    case "DECIMAL":
      return (
        <div>
          {label}
          <input
            type="number"
            inputMode={field.fieldType === "NUMBER" ? "numeric" : "decimal"}
            step={field.fieldType === "NUMBER" ? "1" : "any"}
            min={field.fieldType === "NUMBER" ? "0" : undefined}
            className={inputBaseClass}
            placeholder={field.placeholder ?? undefined}
            value={value === null || value === undefined ? "" : String(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          />
          {help}
        </div>
      );

    case "PERCENT": {
      const pct = value === null || value === undefined ? "" : String(Number(value) * 100);
      return (
        <div>
          {label}
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="any"
              className={`${inputBaseClass} pr-8`}
              placeholder={field.placeholder ?? "0"}
              value={pct}
              disabled={disabled}
              onChange={(e) =>
                onChange(e.target.value === "" ? null : Number(e.target.value) / 100)
              }
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              %
            </span>
          </div>
          {help}
        </div>
      );
    }

    case "DATE":
      return (
        <div>
          {label}
          <input
            type="date"
            className={inputBaseClass}
            value={(value as string) ?? ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
        </div>
      );

    case "BOOLEAN":
      return (
        <div className="flex items-center gap-3 py-1">
          <input
            id={`field-${field.key}`}
            type="checkbox"
            className="h-5 w-5 rounded border-[var(--ads-border-bold)] text-[var(--ads-brand)] focus:ring-[var(--ads-border-focused)]"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <label htmlFor={`field-${field.key}`} className="text-sm font-medium text-slate-700">
            {field.label}
          </label>
        </div>
      );

    case "SELECT":
      return (
        <div>
          {label}
          <select
            className={inputBaseClass}
            value={(value as string) ?? ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">— Select —</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {help}
        </div>
      );

    case "MULTISELECT": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (opt: string) => {
        if (selected.includes(opt)) {
          onChange(selected.filter((v) => v !== opt));
        } else {
          onChange([...selected, opt]);
        }
      };
      return (
        <div>
          {label}
          <div className="flex flex-wrap gap-2">
            {field.options.map((opt) => {
              const active = selected.includes(opt);
              return (
                <button
                  type="button"
                  key={opt}
                  disabled={disabled}
                  onClick={() => toggle(opt)}
                  className={`min-h-9 rounded-[var(--ads-radius)] border px-3 py-1 text-sm ${
                    active
                      ? "border-[var(--ads-brand)] bg-[#e9f2ff] text-[var(--ads-brand-hovered)]"
                      : "border-[var(--ads-border-bold)] bg-[var(--ads-surface)] text-[var(--ads-text-subtle)]"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {help}
        </div>
      );
    }

    case "PHOTO":
      return (
        <div>
          {label}
          <PhotoStrip
            taskRowId={taskRowId}
            onRequireRowSave={onRequireRowSave}
            disabled={disabled}
          />
          {help}
        </div>
      );

    case "TEXT":
    default:
      return (
        <div>
          {label}
          <input
            type="text"
            className={inputBaseClass}
            placeholder={field.placeholder ?? undefined}
            value={(value as string) ?? ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
        </div>
      );
  }
}
