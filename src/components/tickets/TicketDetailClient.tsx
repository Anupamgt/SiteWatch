"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDisplayDate, parseDateOnly } from "@/lib/dates";
import { useI18n } from "@/components/i18n/I18nProvider";

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
  const { t, ticketStatus, roleName } = useI18n();
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
    if (isAdmin) return [...STATUS_FLOW];
    const opts: Array<(typeof STATUS_FLOW)[number]> = [];
    for (const s of STATUS_FLOW) {
      if (s === ticket.status) {
        opts.push(s);
        continue;
      }
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
      setError(typeof data.error === "string" ? data.error : t("common.errorGeneric"));
      return;
    }
    router.refresh();
  }

  async function softDelete() {
    if (!isAdmin || !confirm(t("tickets.removeConfirm"))) return;
    const res = await fetch(`/api/tickets/${ticket.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : t("common.errorGeneric"));
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
      <form
        onSubmit={save}
        className="ads-surface space-y-5 p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-500">
              {ticket.site.code} · {t("tickets.raisedBy")} {ticket.raisedBy.name}
            </p>
            {canEdit ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full border-b border-transparent text-xl font-semibold text-[var(--ads-text)] focus:border-[var(--ads-border-focused)] focus:outline-none"
              />
            ) : (
              <h1 className="mt-1 text-xl font-semibold text-slate-900">{ticket.title}</h1>
            )}
          </div>
          <StatusPill label={ticketStatus(status)} status={status} />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-base font-medium text-slate-800">
            {t("tickets.status")}
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            disabled={!canEdit}
            className="ads-input min-h-12 text-base disabled:bg-[var(--ads-neutral)]"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {ticketStatus(s)}
              </option>
            ))}
          </select>
          {isRaiser && ticket.status === "DONE" && (
            <p className="mt-1.5 text-sm text-slate-500">{t("tickets.statusHelpDone")}</p>
          )}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-base font-medium text-slate-800">
            {t("tickets.description")}
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            disabled={!canEdit}
            className="ads-input py-2.5 text-base disabled:bg-[var(--ads-neutral)]"
          />
        </label>

        <fieldset disabled={!canEditAssignees}>
          <legend className="mb-1 text-base font-medium text-slate-800">
            {t("tickets.assignees")}
          </legend>
          <p className="mb-2 text-sm text-slate-500">{t("tickets.assigneesHelp")}</p>
          <div className="ads-list max-h-48 space-y-0 overflow-y-auto p-2">
            {assignableUsers.map((u) => (
              <label key={u.id} className="flex items-center gap-3 px-2 py-2">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={assigneeIds.includes(u.id)}
                  onChange={() => toggleAssignee(u.id)}
                  disabled={!canEditAssignees}
                />
                <span className="text-base">
                  {u.name}
                  {u.role ? (
                    <span className="text-sm text-slate-500"> · {roleName(u.role)}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {canEdit && (
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="ads-btn ads-btn-primary min-h-12 px-5 text-base"
            >
              {saving ? t("common.saving") : t("common.saveChanges")}
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={softDelete}
                className="ads-btn ads-btn-danger min-h-12 border border-[var(--ads-danger)] px-4 text-base"
              >
                {t("tickets.remove")}
              </button>
            )}
          </div>
        )}
      </form>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-800">{t("tickets.linkedTasks")}</h2>
        {ticket.taskRows.length === 0 ? (
          <p className="ads-empty text-sm leading-relaxed">
            {t("tickets.linkedTasksEmpty")}
          </p>
        ) : (
          <ul className="ads-list">
            {ticket.taskRows.map((row) => {
              const date = row.section.report.reportDate;
              return (
                <li key={row.id} className="ads-list-row px-4 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-medium text-slate-900">
                        {row.taskCode || t("tickets.word")} ·{" "}
                        {row.plannedWorkDescription || "—"}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatDisplayDate(parseDateOnly(date))} ·{" "}
                        {row.status.replaceAll("_", " ")}
                        {row.percentComplete != null
                          ? ` · ${Math.round(row.percentComplete * 100)}%`
                          : ""}
                      </p>
                    </div>
                    <Link
                      href={`/sites/${row.section.report.siteId}/reports/${date}/work-programme`}
                      className="ads-link text-sm"
                    >
                      {t("tickets.openDpr")} →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-800">{t("tickets.descriptionLog")}</h2>
        {ticket.descriptionLogs.length === 0 ? (
          <p className="text-sm text-slate-500">{t("tickets.descriptionLogEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {ticket.descriptionLogs.map((log) => (
              <li
                key={log.id}
                className="ads-surface p-4 text-sm leading-relaxed"
              >
                <p className="text-xs text-slate-500">
                  {log.changedBy.name} · {new Date(log.createdAt).toLocaleString()}
                </p>
                <p className="mt-2 text-slate-600">
                  <span className="font-medium text-slate-400">{t("tickets.descriptionFrom")}:</span>{" "}
                  {log.previousDescription || "—"}
                </p>
                <p className="mt-1 text-slate-800">
                  <span className="font-medium text-slate-400">{t("tickets.descriptionTo")}:</span>{" "}
                  {log.newDescription || "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusPill({ label, status }: { label: string; status: string }) {
  const colors: Record<string, string> = {
    OPEN: "ads-lozenge bg-[#1d7afc14] text-[var(--ads-information)]",
    IN_PROGRESS: "ads-lozenge bg-[#e5691014] text-[var(--ads-warning)]",
    DONE: "ads-lozenge bg-[#22a06b14] text-[var(--ads-success-bold)]",
    CLOSED: "ads-chip",
  };
  return (
    <span className={`px-3 py-1 text-sm font-medium ${colors[status] ?? "ads-chip"}`}>
      {label}
    </span>
  );
}
