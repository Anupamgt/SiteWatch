"use client";

import { useMemo, useState } from "react";
import type { AdminFieldDefinition } from "@/lib/fields";

type SectionType = "WORK_PROGRAMME" | "LABOUR_DEPLOYMENT";

export function FieldConfigEditor({
  siteId,
  sectionType,
  initialFields,
}: {
  siteId: string;
  sectionType: SectionType;
  initialFields: AdminFieldDefinition[];
}) {
  const [fields, setFields] = useState(initialFields);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState("TEXT");
  const [newOptions, setNewOptions] = useState("");

  const ordered = useMemo(
    () => [...fields].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key)),
    [fields]
  );

  async function refresh() {
    const res = await fetch(`/api/sites/${siteId}/fields?sectionType=${sectionType}&admin=1`);
    const data = await res.json();
    setFields(data.fields);
  }

  async function patchField(fieldId: string, body: Record<string, unknown>) {
    setMessage(null);
    const res = await fetch(`/api/sites/${siteId}/fields/${fieldId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Update failed");
      return;
    }
    await refresh();
  }

  async function deleteField(fieldId: string, isSystem: boolean) {
    if (isSystem) {
      setMessage("System fields cannot be deleted; hide them instead.");
      return;
    }
    if (!confirm("Delete this custom field?")) return;
    const res = await fetch(`/api/sites/${siteId}/fields/${fieldId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Delete failed");
      return;
    }
    await refresh();
  }

  async function onDrop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return;
    const keys = ordered.map((f) => f.key);
    const from = keys.indexOf(dragKey);
    const to = keys.indexOf(targetKey);
    keys.splice(from, 1);
    keys.splice(to, 0, dragKey);
    setDragKey(null);
    const res = await fetch(`/api/sites/${siteId}/fields/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionType, orderedKeys: keys }),
    });
    if (!res.ok) {
      setMessage("Reorder failed");
      return;
    }
    const data = await res.json();
    setFields(data.fields);
  }

  async function addCustom(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/sites/${siteId}/fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sectionType,
        key: newKey,
        label: newLabel,
        fieldType: newType,
        options: newOptions
          ? newOptions.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Create failed");
      return;
    }
    setNewKey("");
    setNewLabel("");
    setNewOptions("");
    await refresh();
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className="ads-flag px-3 py-2 text-sm text-[var(--ads-text)]">{message}</p>
      )}

      <ul className="ads-list">
        {ordered.map((f) => (
          <li
            key={f.id + f.key}
            draggable
            onDragStart={() => setDragKey(f.key)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(f.key)}
            className="flex flex-wrap items-center gap-3 px-4 py-3"
          >
            <span className="cursor-grab text-slate-400" title="Drag to reorder">
              ⋮⋮
            </span>
            <div className="min-w-[10rem] flex-1">
              <input
                className="ads-input py-1 text-sm font-medium"
                defaultValue={f.label}
                onBlur={(e) => {
                  if (e.target.value !== f.label) patchField(f.id, { label: e.target.value });
                }}
              />
              <p className="text-xs text-slate-400">
                {f.key} · {f.fieldType} · {f.origin} {f.isSystem ? "· system" : "· custom"}
              </p>
            </div>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={f.isRequired}
                onChange={(e) => patchField(f.id, { isRequired: e.target.checked })}
              />
              Required
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={f.isActive}
                onChange={(e) => patchField(f.id, { isActive: e.target.checked })}
              />
              Visible
            </label>
            {!f.isSystem && (
              <button
                type="button"
                onClick={() => deleteField(f.id, f.isSystem)}
                className="text-xs text-red-600 hover:underline"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={addCustom} className="ads-surface space-y-3 p-4">
        <h3 className="text-sm font-semibold">Add custom field</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            required
            className="ads-input min-h-11"
          />
          <input
            placeholder="camelCase key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            required
            className="ads-input min-h-11"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="ads-input min-h-11"
          >
            {["TEXT", "TEXTAREA", "NUMBER", "DECIMAL", "SELECT", "BOOLEAN", "PERCENT"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            placeholder="Options (comma-separated for SELECT)"
            value={newOptions}
            onChange={(e) => setNewOptions(e.target.value)}
            className="ads-input min-h-11"
          />
        </div>
        <button type="submit" className="ads-btn ads-btn-primary text-sm">
          Add field
        </button>
      </form>
    </div>
  );
}
