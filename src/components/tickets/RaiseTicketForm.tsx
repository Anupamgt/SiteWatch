"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";

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
  const { t, roleName } = useI18n();
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

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError(t("tickets.needTitle"));
      return;
    }
    if (assigneeIds.length === 0) {
      setError(t("tickets.needAssignees"));
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
      setError(typeof data.error === "string" ? data.error : t("tickets.createFailed"));
      return;
    }
    const data = await res.json();
    router.push(`/tickets/${data.ticket.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <label className="block text-sm">
        <span className="mb-1.5 block text-base font-medium text-slate-800">{t("tickets.site")}</span>
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base"
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
        <span className="mb-1.5 block text-base font-medium text-slate-800">
          {t("tickets.title")} <span className="text-red-600">*</span>
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base"
          placeholder={t("tickets.titlePlaceholder")}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block text-base font-medium text-slate-800">
          {t("tickets.description")}
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
          placeholder={t("tickets.descriptionPlaceholder")}
        />
      </label>

      <fieldset>
        <legend className="mb-1 text-base font-medium text-slate-800">
          {t("tickets.assignees")} <span className="text-red-600">*</span>
        </legend>
        <p className="mb-2 text-sm text-slate-500">{t("tickets.assigneesHelp")}</p>
        <div className="max-h-60 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {users.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-slate-500">{t("tickets.noAssignees")}</p>
          )}
          {users.map((u) => (
            <label
              key={u.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={assigneeIds.includes(u.id)}
                onChange={() => toggleAssignee(u.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium text-slate-900">{u.name}</span>
                <span className="block text-sm text-slate-500">
                  {roleName(u.role)} · {u.email}
                </span>
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

      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="min-h-12 flex-1 rounded-lg bg-amber-500 px-4 text-base font-semibold text-slate-900 disabled:opacity-60 sm:flex-none"
        >
          {saving ? t("tickets.raising") : t("tickets.raiseCta")}
        </button>
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          className="min-h-12 rounded-lg border border-slate-300 px-4 text-base text-slate-700"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
