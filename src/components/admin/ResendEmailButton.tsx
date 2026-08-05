"use client";

import { useState } from "react";

export function ResendEmailButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/corrective-actions/${id}/resend-email`, { method: "POST" });
    setBusy(false);
    setMsg(res.ok ? "Resent" : "Failed");
  }

  return (
    <button
      type="button"
      onClick={resend}
      disabled={busy}
      className="text-xs font-medium text-amber-700 hover:underline disabled:opacity-50"
    >
      {msg || (busy ? "…" : "Resend")}
    </button>
  );
}
