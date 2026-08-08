"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminReportActions({
  reportId,
  approved,
  approvedBy,
  workStatus,
  labourStatus,
}: {
  reportId: string;
  approved: boolean;
  approvedBy: string | null;
  workStatus: string | null;
  labourStatus: string | null;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  async function approve() {
    const res = await fetch(`/api/reports/${reportId}/approve`, { method: "POST" });
    setMsg(res.ok ? "Approved" : "Approve failed");
    router.refresh();
  }

  async function reopen(type: string) {
    const res = await fetch(`/api/reports/${reportId}/sections/${type}/reopen`, { method: "POST" });
    setMsg(res.ok ? "Reopened" : "Reopen failed");
    router.refresh();
  }

  return (
    <div className="ads-surface flex flex-wrap items-center gap-2 p-3 text-sm">
      {approved ? (
        <span className="text-[var(--ads-success-bold)]">Approved by {approvedBy || "HO"}</span>
      ) : (
        <button type="button" onClick={approve} className="ads-btn ads-btn-primary px-3 py-2 text-sm">
          Approve report
        </button>
      )}
      {workStatus === "SUBMITTED" && (
        <button
          type="button"
          onClick={() => reopen("WORK_PROGRAMME")}
          className="ads-btn ads-btn-default px-3 py-2 text-sm"
        >
          Reopen work programme
        </button>
      )}
      {labourStatus === "SUBMITTED" && (
        <button
          type="button"
          onClick={() => reopen("LABOUR_DEPLOYMENT")}
          className="ads-btn ads-btn-default px-3 py-2 text-sm"
        >
          Reopen labour
        </button>
      )}
      {msg && <span className="text-[var(--ads-text-subtle)]">{msg}</span>}
    </div>
  );
}
