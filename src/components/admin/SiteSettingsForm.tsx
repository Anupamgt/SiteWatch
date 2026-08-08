"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function SiteSettingsForm({
  site,
}: {
  site: {
    id: string;
    code: string;
    name: string;
    projectName: string;
    locationZone: string | null;
    contractorClient: string | null;
    standardShiftHours: number;
    isActive: boolean;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/sites/${site.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: fd.get("code"),
        name: fd.get("name"),
        projectName: fd.get("projectName"),
        locationZone: String(fd.get("locationZone") || "") || null,
        contractorClient: String(fd.get("contractorClient") || "") || null,
        standardShiftHours: Number(fd.get("standardShiftHours") || 8),
        isActive: fd.get("isActive") === "on",
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Save failed");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="ads-surface space-y-3 p-5">
      {(
        [
          ["code", "Code", site.code],
          ["name", "Name", site.name],
          ["projectName", "Project", site.projectName],
          ["locationZone", "Location / Zone", site.locationZone ?? ""],
          ["contractorClient", "Contractor / Client", site.contractorClient ?? ""],
        ] as const
      ).map(([name, label, value]) => (
        <div key={name}>
          <label className="ads-label normal-case tracking-normal">{label}</label>
          <input
            name={name}
            defaultValue={value}
            className="ads-input min-h-11"
            required={name === "code" || name === "name" || name === "projectName"}
          />
        </div>
      ))}
      <div>
        <label className="ads-label normal-case tracking-normal">Standard shift hours</label>
        <input
          name="standardShiftHours"
          type="number"
          step="0.5"
          defaultValue={site.standardShiftHours}
          className="ads-input min-h-11"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={site.isActive} /> Active
      </label>
      {error && <p className="text-sm text-[var(--ads-danger)]">{error}</p>}
      <button type="submit" className="ads-btn ads-btn-primary">
        Save settings
      </button>
      <p className="text-xs text-[var(--ads-text-subtle)]">
        Editing site defaults does not change historical report header snapshots.
      </p>
    </form>
  );
}
