"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ReportHeaderEditor({
  siteId,
  date,
  reportId,
  values,
}: {
  siteId: string;
  date: string;
  reportId: string | null;
  values: {
    siteEngineerName: string;
    siteSupervisorName: string;
    weatherCondition: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      siteEngineerName: String(fd.get("siteEngineerName") || ""),
      siteSupervisorName: String(fd.get("siteSupervisorName") || ""),
      weatherCondition: String(fd.get("weatherCondition") || ""),
    };

    let id = reportId;
    if (!id) {
      const created = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, reportDate: date }),
      });
      if (!created.ok) {
        setSaving(false);
        setError("Could not create report");
        return;
      }
      const data = await created.json();
      id = (data.report?.id ?? data.id) as string;
    }

    const res = await fetch(`/api/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Save failed");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="ads-surface space-y-3 p-4">
      <p className="ads-label">Edit header</p>
      {(
        [
          ["siteEngineerName", "Site Engineer", values.siteEngineerName],
          ["siteSupervisorName", "Site Supervisor", values.siteSupervisorName],
          ["weatherCondition", "Weather", values.weatherCondition],
        ] as const
      ).map(([name, label, value]) => (
        <div key={name}>
          <label className="ads-label">{label}</label>
          <input
            name={name}
            defaultValue={value}
            className="ads-input min-h-11"
          />
        </div>
      ))}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="ads-btn ads-btn-primary min-h-11"
      >
        {saving ? "Saving…" : "Save header"}
      </button>
    </form>
  );
}
