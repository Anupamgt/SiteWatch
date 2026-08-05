"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NewActionForm({
  sites,
  engineers,
  defaults,
}: {
  sites: Array<{ id: string; code: string; name: string }>;
  engineers: Array<{ id: string; name: string; email: string; siteIds: string[] }>;
  defaults: { siteId: string; reportId: string; taskRowId: string };
}) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(defaults.siteId || sites[0]?.id || "");
  const [error, setError] = useState<string | null>(null);
  const filtered = useMemo(
    () => engineers.filter((e) => e.siteIds.includes(siteId)),
    [engineers, siteId]
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/corrective-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId,
        reportId: String(fd.get("reportId") || "") || null,
        taskRowId: String(fd.get("taskRowId") || "") || null,
        title: fd.get("title"),
        description: fd.get("description") || null,
        guidance: fd.get("guidance") || null,
        priority: fd.get("priority") || "MEDIUM",
        dueDate: String(fd.get("dueDate") || "") || null,
        assignedToId: fd.get("assignedToId"),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed");
      return;
    }
    router.push("/admin/corrective-actions");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border bg-white p-5">
      <div>
        <label className="mb-1 block text-sm font-medium">Site</label>
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
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Assign to</label>
        <select name="assignedToId" required className="min-h-11 w-full rounded-md border px-3">
          <option value="">Select engineer…</option>
          {filtered.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.email})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Title</label>
        <input name="title" required className="min-h-11 w-full rounded-md border px-3" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">HO guidance</label>
        <textarea name="guidance" rows={3} className="w-full rounded-md border px-3 py-2" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Priority</label>
          <select name="priority" defaultValue="MEDIUM" className="min-h-11 w-full rounded-md border px-3">
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Due date</label>
          <input name="dueDate" type="date" className="min-h-11 w-full rounded-md border px-3" />
        </div>
      </div>
      <input type="hidden" name="reportId" defaultValue={defaults.reportId} />
      <input type="hidden" name="taskRowId" defaultValue={defaults.taskRowId} />
      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea name="description" rows={2} className="w-full rounded-md border px-3 py-2" />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" className="rounded-md bg-amber-500 px-4 py-2 font-semibold">
        Create & email engineer
      </button>
    </form>
  );
}
