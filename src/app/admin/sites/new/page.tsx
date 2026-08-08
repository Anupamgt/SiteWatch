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
      <form onSubmit={onSubmit} className="ads-surface space-y-3 p-5">
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
            <label className="ads-label normal-case tracking-normal">{label}</label>
            <input
              name={name}
              required={required}
              className="ads-input min-h-11"
            />
          </div>
        ))}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="ads-btn ads-btn-primary min-h-11"
        >
          {loading ? "Creating…" : "Create site"}
        </button>
      </form>
    </main>
  );
}
