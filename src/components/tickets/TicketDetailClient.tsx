"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDateOnly, formatDisplayDate } from "@/lib/dates";

type Person = { id: string; name: string; email?: string; role?: string };

export type TicketDetail = {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "CLOSED";
  siteId: string;
  raisedById: string;
  site: { id: string; code: string; name: string };
  raisedBy: Person;
  closedBy: Person | null;
  closedAt: string | null;
  assignees: Array<{ userId: string; user: Person }>;
  descriptionLogs: Array<{
    id: string;
    previousDescription: string | null;
    newDescription: string | null;
    createdAt: string;
    changedBy: Person;
  }>;
  taskRows: Array<{
    id: string;
    taskCode: string | null;
    plannedWorkDescription: string | null;
    status: string;
    percentComplete: number | null;
    section: {
      report: { id: string; reportDate: string; siteId: string };
    };
  }>;
};

const STATUS_FLOW = ["OPEN", "IN_PROGRESS", "DONE", "CLOSED"] as const;

export function TicketDetailClient({
  ticket,
  currentUserId,
  currentUserRole,
  assignableUsers,
}: {
  ticket: TicketDetail;
  currentUserId: string;
  currentUserRole: string;
  assignableUsers: Person[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description ?? "");
  const [status, setStatus] = useState(ticket.status);
  const [assigneeIds, setAssigneeIds] = useState(ticket.assignees.map((a) => a.userId));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isRaiser = ticket.raisedById === currentUserId;
  const isAssigned = ticket.assignees.some((a) => a.userId === currentUserId);
  const isAdmin = currentUserRole === "ADMIN";
  const canEdit = isAdmin || isRaiser || isAssigned;
  const canEditAssignees = isAdmin || isRaiser;

  const statusOptions = useMemo(() => {
    if (isAdmin) return STATUS_FLOW;
    const opts: Array<(typeof STATUS_FLOW)[number]> = [];
    for (const s of STATUS_FLOW) {
      if (s === ticket.status) {
        opts.push(s);
        continue;
      }
      // Mirror server rules roughly for UX
      if ((isAssigned || isRaiser) && ticket.status !== "CLOSED") {
        if (s === "OPEN" || s === "IN_PROGRESS" || s === "DONE") opts.push(s);
      }
      if (isRaiser && ticket.status === "DONE" && s === "CLOSED") opts.push(s);
      if (isRaiser && ticket.status === "CLOSED" && s !== "CLOSED") opts.push(s);
    }
    return [...new Set(opts)];
  }, [isAdmin, isAssigned, isRaiser, ticket.status]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        status,
        ...(canEditAssignees ? { assigneeIds } : {}),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Save failed");
      return;
    }
    router.refresh();
  }

  async function softDelete() {
    if (!isAdmin || !confirm("Soft-delete this ticket? It will be hidden from lists.")) return;
    const res = await fetch(`/api/tickets/${ticket.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Delete failed");
      return;
    }
    router.push("/tickets");
    router.refresh();
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {ticket.site.code} · raised by {ticket.raisedBy.name}
            </p>
            {canEdit ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full min-w-[16rem] border-b border-transparent text-xl font-semibold text-slate-900 focus:border-amber-400 focus:outline-none"
              />
            ) : (
              <h1 className="mt-1 text-xl font-semibold text-slate-900">{ticket.title}</h1>
            )}
          </div>
          <StatusPill status={status} />
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            disabled={!canEdit}
            className="min-h-11 w-full rounded-md border px-3 disabled:bg-slate-50"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          {isRaiser && ticket.status === "DONE" && (
            <p className="mt-1 text-xs text-slate-500">
              Review linked DPR progress below, then set status to CLOSED.
            </p>
          )}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            disabled={!canEdit}
            className="w-full rounded-md border px-3 py-2 disabled:bg-slate-50"
          />
        </label>

        <fieldset className="text-sm" disabled={!canEditAssignees}>
          <legend className="mb-2 font-medium">Assignees</legend>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
            {assignableUsers.map((u) => (
              <label key={u.id} className="flex items-center gap-2 px-2 py-1.5">
                <input
                  type="checkbox"
                  checked={assigneeIds.includes(u.id)}
                  onChange={() => toggleAssignee(u.id)}
                  disabled={!canEditAssignees}
                />
                <span>
                  {u.name}
                  {u.role ? (
                    <span className="text-xs text-slate-500"> · {u.role}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-700">{error}</p>}

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={softDelete}
                className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-700"
              >
                Soft delete
              </button>
            )}
          </div>
        )}
      </form>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Linked DPR tasks</h2>
        {ticket.taskRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
            No daily work rows linked yet. Assignees can link tasks from Work Programme.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border border-slate-200 bg-white">
            {ticket.taskRows.map((row) => {
              const date = formatDateOnly(new Date(row.section.report.reportDate));
              return (
                <li key={row.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {row.taskCode || "Task"} · {row.plannedWorkDescription || "—"}
                      </p>
                      <p className="text-slate-500">
                        {formatDisplayDate(new Date(row.section.report.reportDate))} ·{" "}
                        {row.status.replaceAll("_", " ")}
                        {row.percentComplete != null
                          ? ` · ${Math.round(row.percentComplete * 100)}%`
                          : ""}
                      </p>
                    </div>
                    <Link
                      href={`/sites/${row.section.report.siteId}/reports/${date}/work-programme`}
                      className="text-amber-700 hover:underline"
                    >
                      Open DPR →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Description change log</h2>
        {ticket.descriptionLogs.length === 0 ? (
          <p className="text-sm text-slate-500">No description edits yet.</p>
        ) : (
          <ul className="space-y-2">
            {ticket.descriptionLogs.map((log) => (
              <li key={log.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <p className="text-xs text-slate-500">
                  {log.changedBy.name} · {new Date(log.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-slate-600">
                  <span className="text-slate-400">From:</span> {log.previousDescription || "—"}
                </p>
                <p className="text-slate-800">
                  <span className="text-slate-400">To:</span> {log.newDescription || "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OPEN: "bg-sky-50 text-sky-800",
    IN_PROGRESS: "bg-amber-50 text-amber-900",
    DONE: "bg-emerald-50 text-emerald-800",
    CLOSED: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${colors[status] ?? "bg-slate-100"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
