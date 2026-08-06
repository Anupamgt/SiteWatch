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
    [machines, editingId]
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
        <p className="text-sm text-slate-500">
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
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            + Add machine
          </button>
        )}
      </div>

      {(showForm || editing) && canEdit && (
        <form
          onSubmit={save}
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h3 className="font-semibold text-slate-900">
            {editing ? "Edit machine" : "New machine"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Site</span>
              <select
                name="siteId"
                required
                defaultValue={editing?.siteId ?? defaultSiteId ?? sites[0]?.id}
                className="min-h-11 w-full rounded-md border px-3"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Name *</span>
              <input
                name="name"
                required
                defaultValue={editing?.name}
                className="min-h-11 w-full rounded-md border px-3"
                placeholder="JCB 3DX"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Category</span>
              <input
                name="category"
                defaultValue={editing?.category ?? ""}
                className="min-h-11 w-full rounded-md border px-3"
                placeholder="Excavator, Crane, Mixer…"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Ownership</span>
              <select
                name="ownership"
                defaultValue={editing?.ownership ?? "OWNED"}
                className="min-h-11 w-full rounded-md border px-3"
              >
                <option value="OWNED">Owned by us</option>
                <option value="RENTED">On rent</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Status</span>
              <select
                name="status"
                defaultValue={editing?.status ?? "ACTIVE"}
                className="min-h-11 w-full rounded-md border px-3"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Owner / rental vendor</span>
              <input
                name="ownerLabel"
                defaultValue={editing?.ownerLabel ?? ""}
                className="min-h-11 w-full rounded-md border px-3"
                placeholder="Self / ABC Rentals"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Registration / asset no.</span>
              <input
                name="registration"
                defaultValue={editing?.registration ?? ""}
                className="min-h-11 w-full rounded-md border px-3"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Daily rate (rent)</span>
              <input
                name="dailyRate"
                type="number"
                step="0.01"
                defaultValue={editing?.dailyRate ?? ""}
                className="min-h-11 w-full rounded-md border px-3"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Notes</span>
              <textarea
                name="notes"
                defaultValue={editing?.notes ?? ""}
                rows={2}
                className="w-full rounded-md border px-3 py-2"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} />
            Active
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Machine</th>
              <th className="px-3 py-2">Site</th>
              <th className="px-3 py-2">Ownership</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Owner / vendor</th>
              <th className="px-3 py-2">Rate</th>
              {canEdit && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">
                  {m.name}
                  {m.category ? <span className="text-slate-500"> · {m.category}</span> : null}
                  {!m.isActive && <span className="ml-2 text-xs text-red-600">inactive</span>}
                </td>
                <td className="px-3 py-2 text-slate-600">{m.site?.code ?? "—"}</td>
                <td className="px-3 py-2">
                  <OwnershipBadge ownership={m.ownership} />
                </td>
                <td className="px-3 py-2">{m.status.replaceAll("_", " ")}</td>
                <td className="px-3 py-2 text-slate-600">{m.ownerLabel || "—"}</td>
                <td className="px-3 py-2 text-slate-600">
                  {m.dailyRate == null ? "—" : m.dailyRate.toLocaleString()}
                </td>
                {canEdit && (
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      type="button"
                      className="text-amber-700 hover:underline"
                      onClick={() => {
                        setEditingId(m.id);
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
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
                <td colSpan={canEdit ? 7 : 6} className="px-3 py-6 text-center text-slate-500">
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
