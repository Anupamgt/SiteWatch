"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { OwnershipBadge } from "@/components/DashboardInsightsPanel";

export type MachineRow = {
  id: string;
  name: string;
  category: string | null;
  ownership: "OWNED" | "RENTED";
  status: "ACTIVE" | "IDLE" | "UNDER_MAINTENANCE" | "OFFSITE";
  ownerLabel: string | null;
  registration: string | null;
  dailyRate: number | null;
  notes: string | null;
  isActive: boolean;
  siteId: string;
  site?: { id: string; code: string; name: string };
};

type SiteOption = { id: string; code: string; name: string };

const STATUSES = ["ACTIVE", "IDLE", "UNDER_MAINTENANCE", "OFFSITE"] as const;

export function MachinesManager({
  machines,
  sites,
  canEdit,
  defaultSiteId,
}: {
  machines: MachineRow[];
  sites: SiteOption[];
  canEdit: boolean;
  defaultSiteId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const editing = useMemo(
    () => machines.find((m) => m.id === editingId) ?? null,
    [machines, editingId],
  );

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      siteId: String(fd.get("siteId") || ""),
      name: String(fd.get("name") || ""),
      category: String(fd.get("category") || "") || null,
      ownership: String(fd.get("ownership") || "OWNED"),
      status: String(fd.get("status") || "ACTIVE"),
      ownerLabel: String(fd.get("ownerLabel") || "") || null,
      registration: String(fd.get("registration") || "") || null,
      dailyRate: String(fd.get("dailyRate") || "") || null,
      notes: String(fd.get("notes") || "") || null,
      isActive: fd.get("isActive") === "on",
    };

    const url = editingId ? `/api/machines/${editingId}` : "/api/machines";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg =
        typeof data.error === "string"
          ? data.error
          : data.error
            ? JSON.stringify(data.error)
            : "Save failed";
      setError(msg);
      return;
    }
    setShowForm(false);
    setEditingId(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!canEdit || !confirm("Deactivate this machine?")) return;
    await fetch(`/api/machines/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--ads-text-subtle)]">
          Track site machines as <strong>Owned by us</strong> or <strong>On rent</strong>. All roles
          with site access can view; edits respect your site permissions.
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setShowForm(true);
            }}
            className="ads-btn ads-btn-primary text-sm"
          >
            + Add machine
          </button>
        )}
      </div>

      {(showForm || editing) && canEdit && (
        <form onSubmit={save} className="ads-surface space-y-3 p-4">
          <h3 className="font-semibold text-[var(--ads-text)]">
            {editing ? "Edit machine" : "New machine"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="ads-label normal-case tracking-normal">Site</span>
              <select
                name="siteId"
                required
                defaultValue={editing?.siteId ?? defaultSiteId ?? sites[0]?.id}
                className="ads-input min-h-11"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="ads-label normal-case tracking-normal">Name *</span>
              <input
                name="name"
                required
                defaultValue={editing?.name}
                className="ads-input min-h-11"
                placeholder="JCB 3DX"
              />
            </label>
            <label className="text-sm">
              <span className="ads-label normal-case tracking-normal">Category</span>
              <input
                name="category"
                defaultValue={editing?.category ?? ""}
                className="ads-input min-h-11"
                placeholder="Excavator, Crane, Mixer…"
              />
            </label>
            <label className="text-sm">
              <span className="ads-label normal-case tracking-normal">Ownership</span>
              <select
                name="ownership"
                defaultValue={editing?.ownership ?? "OWNED"}
                className="ads-input min-h-11"
              >
                <option value="OWNED">Owned by us</option>
                <option value="RENTED">On rent</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="ads-label normal-case tracking-normal">Status</span>
              <select
                name="status"
                defaultValue={editing?.status ?? "ACTIVE"}
                className="ads-input min-h-11"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="ads-label normal-case tracking-normal">Owner / rental vendor</span>
              <input
                name="ownerLabel"
                defaultValue={editing?.ownerLabel ?? ""}
                className="ads-input min-h-11"
                placeholder="Self / ABC Rentals"
              />
            </label>
            <label className="text-sm">
              <span className="ads-label normal-case tracking-normal">Registration / asset no.</span>
              <input
                name="registration"
                defaultValue={editing?.registration ?? ""}
                className="ads-input min-h-11"
              />
            </label>
            <label className="text-sm">
              <span className="ads-label normal-case tracking-normal">Daily rate (rent)</span>
              <input
                name="dailyRate"
                type="number"
                step="0.01"
                defaultValue={editing?.dailyRate ?? ""}
                className="ads-input min-h-11"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="ads-label normal-case tracking-normal">Notes</span>
              <textarea
                name="notes"
                defaultValue={editing?.notes ?? ""}
                rows={2}
                className="ads-input py-2"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} />
            Active
          </label>
          {error && <p className="text-sm text-[var(--ads-danger)]">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="ads-btn ads-btn-primary text-sm">
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="ads-btn ads-btn-default text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="ads-table-wrap">
        <table className="ads-table">
          <thead>
            <tr>
              <th>Machine</th>
              <th>Site</th>
              <th>Ownership</th>
              <th>Status</th>
              <th>Owner / vendor</th>
              <th>Rate</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id}>
                <td className="font-medium">
                  {m.name}
                  {m.category ? (
                    <span className="text-[var(--ads-text-subtle)]"> · {m.category}</span>
                  ) : null}
                  {!m.isActive && (
                    <span className="ml-2 text-xs text-[var(--ads-danger)]">inactive</span>
                  )}
                </td>
                <td className="text-[var(--ads-text-subtle)]">{m.site?.code ?? "—"}</td>
                <td>
                  <OwnershipBadge ownership={m.ownership} />
                </td>
                <td>{m.status.replaceAll("_", " ")}</td>
                <td className="text-[var(--ads-text-subtle)]">{m.ownerLabel || "—"}</td>
                <td className="text-[var(--ads-text-subtle)]">
                  {m.dailyRate == null ? "—" : m.dailyRate.toLocaleString()}
                </td>
                {canEdit && (
                  <td className="space-x-2 text-right">
                    <button
                      type="button"
                      className="ads-link text-sm"
                      onClick={() => {
                        setEditingId(m.id);
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ads-btn ads-btn-danger text-sm"
                      onClick={() => remove(m.id)}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {machines.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 7 : 6} className="py-6 text-center text-[var(--ads-text-subtle)]">
                  No machines yet. {canEdit ? "Add one to get started." : ""}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
