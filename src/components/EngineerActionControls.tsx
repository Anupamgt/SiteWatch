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
          className="ads-btn ads-btn-primary min-h-11 w-full text-sm"
        >
          Start work
        </button>
      )}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Closure note / progress note"
        className="ads-input text-sm"
        rows={2}
      />
      <button
        type="button"
        disabled={busy || !note.trim()}
        onClick={() => patch({ closureNote: note, status: status === "OPEN" ? "IN_PROGRESS" : undefined })}
        className="ads-btn ads-btn-default min-h-11 w-full text-sm"
      >
        Propose closure note
      </button>
    </div>
  );
}
