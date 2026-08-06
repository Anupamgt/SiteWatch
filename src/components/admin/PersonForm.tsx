"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type SiteOption = { id: string; code: string; name: string };

type Initial = {
  id: string;
  name: string;
  email: string;
  role: "ENGINEER" | "SUPERVISOR" | "ADMIN";
  phone: string | null;
  isActive: boolean;
  hasPassword: boolean;
  siteIds: string[];
};

export function PersonForm({
  mode,
  sites,
  initial,
}: {
  mode: "create" | "edit";
  sites: SiteOption[];
  initial?: Initial;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [siteIds, setSiteIds] = useState<string[]>(initial?.siteIds ?? []);
  const [role, setRole] = useState(initial?.role ?? "ENGINEER");

  function toggleSite(id: string) {
    setSiteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    const body: Record<string, unknown> = {
      name: String(fd.get("name") || ""),
      email: String(fd.get("email") || ""),
      role,
      phone: String(fd.get("phone") || "") || null,
      isActive: fd.get("isActive") === "on",
      siteIds: role === "ADMIN" ? [] : siteIds,
    };
    if (password) body.password = password;

    const res = await fetch(mode === "create" ? "/api/users" : `/api/users/${initial!.id}`, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Save failed");
      return;
    }
    router.push("/admin/users");
    router.refresh();
  }

  async function deactivate() {
    if (!initial || !confirm("Deactivate this user?")) return;
    await fetch(`/api/users/${initial.id}`, { method: "DELETE" });
    router.push("/admin/users");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" name="name" defaultValue={initial?.name} required />
        <Field
          label="Email / Gmail (login identity)"
          name="email"
          type="email"
          defaultValue={initial?.email}
          required
        />
        <div>
          <label className="mb-1 block text-sm font-medium">Role</label>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Initial["role"])}
            className="min-h-11 w-full rounded-md border border-slate-300 px-3"
          >
            <option value="ENGINEER">Site engineer</option>
            <option value="SUPERVISOR">Site supervisor</option>
            <option value="ADMIN">Admin (head office)</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {role === "SUPERVISOR"
              ? "Supervisors can be assigned to multiple sites like engineers, but cannot access People / org directory."
              : role === "ADMIN"
                ? "Admins manage sites, people, and all reports. Site memberships are not required."
                : "Engineers file daily work programme and labour for assigned sites only."}
          </p>
        </div>
        <Field label="Phone" name="phone" defaultValue={initial?.phone ?? ""} />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">
            {mode === "create" ? "Password (optional if Google-only)" : "Set / reset password"}
          </label>
          <input
            name="password"
            type="password"
            minLength={6}
            placeholder={
              initial?.hasPassword
                ? "Leave blank to keep current password"
                : "Optional — leave blank for Google Sign-In only"
            }
            className="min-h-11 w-full rounded-md border border-slate-300 px-3"
          />
          <p className="mt-1 text-xs text-slate-500">
            Google Sign-In only works if this exact email already exists here and is active.
          </p>
        </div>
      </div>

      {role !== "ADMIN" && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Site memberships</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {sites.map((s) => (
              <label key={s.id} className="flex min-h-11 items-center gap-2 rounded-md border px-3">
                <input
                  type="checkbox"
                  checked={siteIds.includes(s.id)}
                  onChange={() => toggleSite(s.id)}
                />
                <span className="text-sm">
                  {s.code} — {s.name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} />
        Active
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="min-h-11 rounded-md bg-amber-500 px-4 py-2 font-semibold text-slate-900 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save"}
        </button>
        {mode === "edit" && (
          <button
            type="button"
            onClick={deactivate}
            className="min-h-11 rounded-md border border-red-300 px-4 py-2 text-red-700"
          >
            Deactivate
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="min-h-11 w-full rounded-md border border-slate-300 px-3"
      />
    </div>
  );
}
