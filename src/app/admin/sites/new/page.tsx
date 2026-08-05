"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function NewSitePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      code: String(fd.get("code") || ""),
      name: String(fd.get("name") || ""),
      projectName: String(fd.get("projectName") || ""),
      locationZone: String(fd.get("locationZone") || "") || null,
      contractorClient: String(fd.get("contractorClient") || "") || null,
    };
    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create site");
      return;
    }
    const data = await res.json();
    router.push(`/admin/sites/${data.site.id}`);
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">New site</h1>
      <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        {(
          [
            ["code", "Code (e.g. BIJ)", true],
            ["name", "Site name", true],
            ["projectName", "Project name", true],
            ["locationZone", "Location / Zone", false],
            ["contractorClient", "Contractor / Client", false],
          ] as const
        ).map(([name, label, required]) => (
          <div key={name}>
            <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
            <input
              name={name}
              required={required}
              className="min-h-11 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
        ))}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="min-h-11 rounded-md bg-amber-500 px-4 py-2 font-semibold text-slate-900 disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create site"}
        </button>
      </form>
    </main>
  );
}
