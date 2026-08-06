"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type SiteOpt = { id: string; code: string; name: string };
type UserOpt = { id: string; name: string; email: string; role: string };

export function RaiseTicketForm({
  sites,
  defaultSiteId,
  cancelHref,
}: {
  sites: SiteOpt[];
  defaultSiteId?: string;
  cancelHref: string;
}) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(defaultSiteId || sites[0]?.id || "");
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/sites/${siteId}/assignable-users`);
      if (!res.ok) return;
      const data = await res.json();
      if (cancelled) return;
      setUsers(data.users ?? []);
      setAssigneeIds([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const roleLabel = useMemo(
    () =>
      Object.fromEntries(
        users.map((u) => [
          u.id,
          u.role === "ADMIN" ? "Admin" : u.role === "SUPERVISOR" ? "Supervisor" : "Engineer",
        ]),
      ),
    [users],
  );

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (assigneeIds.length === 0) {
      setError("Select at least one assignee");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId,
        title: title.trim(),
        description: description.trim() || null,
        assigneeIds,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Failed to raise ticket");
      return;
    }
    const data = await res.json();
    router.push(`/tickets/${data.ticket.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Site</span>
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="min-h-11 w-full rounded-md border px-3"
          required
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Title *</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-h-11 w-full rounded-md border px-3"
          placeholder="Install formwork Zone A"
          required
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full rounded-md border px-3 py-2"
          placeholder="Scope, constraints, acceptance criteria…"
        />
      </label>

      <fieldset className="text-sm">
        <legend className="mb-2 font-medium">Assignees * (multi-select)</legend>
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
          {users.length === 0 && (
            <p className="px-2 py-3 text-slate-500">No eligible users for this site.</p>
          )}
          {users.map((u) => (
            <label
              key={u.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={assigneeIds.includes(u.id)}
                onChange={() => toggleAssignee(u.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-900">{u.name}</span>
                <span className="block text-xs text-slate-500">
                  {roleLabel[u.id]} · {u.email}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60"
        >
          {saving ? "Raising…" : "Raise ticket"}
        </button>
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          className="rounded-md border px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
