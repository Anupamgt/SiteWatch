"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function EngineerActionControls({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/corrective-actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {status === "OPEN" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => patch({ status: "IN_PROGRESS" })}
          className="min-h-11 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Start work
        </button>
      )}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Closure note / progress note"
        className="w-full rounded-md border px-3 py-2 text-sm"
        rows={2}
      />
      <button
        type="button"
        disabled={busy || !note.trim()}
        onClick={() => patch({ closureNote: note, status: status === "OPEN" ? "IN_PROGRESS" : undefined })}
        className="min-h-11 w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
      >
        Propose closure note
      </button>
    </div>
  );
}
