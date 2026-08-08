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
      className="ads-surface space-y-5 p-5"
    >
      <label className="block text-sm">
        <span className="ads-label normal-case tracking-normal text-base">{t("tickets.site")}</span>
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="ads-input min-h-12 text-base"
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
        <span className="ads-label normal-case tracking-normal text-base">
          {t("tickets.title")} <span className="text-[var(--ads-danger)]">*</span>
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="ads-input min-h-12 text-base"
          placeholder={t("tickets.titlePlaceholder")}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="ads-label normal-case tracking-normal text-base">
          {t("tickets.description")}
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="ads-input py-2.5 text-base"
          placeholder={t("tickets.descriptionPlaceholder")}
        />
      </label>

      <fieldset>
        <legend className="ads-label normal-case tracking-normal text-base">
          {t("tickets.assignees")} <span className="text-[var(--ads-danger)]">*</span>
        </legend>
        <p className="mb-2 text-sm text-[var(--ads-text-subtle)]">{t("tickets.assigneesHelp")}</p>
        <div className="ads-list max-h-60 space-y-0 overflow-y-auto p-2">
          {users.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-slate-500">{t("tickets.noAssignees")}</p>
          )}
          {users.map((u) => (
            <label
              key={u.id}
              className="flex cursor-pointer items-center gap-3 rounded-[var(--ads-radius)] px-3 py-2.5 hover:bg-[var(--ads-neutral)]"
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
          className="ads-btn ads-btn-primary min-h-12 flex-1 text-base sm:flex-none"
        >
          {saving ? t("tickets.raising") : t("tickets.raiseCta")}
        </button>
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          className="ads-btn ads-btn-default min-h-12 text-base"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
