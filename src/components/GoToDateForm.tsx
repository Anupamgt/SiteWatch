"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function GoToDateForm({ siteId, defaultDate }: { siteId: string; defaultDate: string }) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/sites/${siteId}/reports/${date}`);
      }}
      className="flex items-center gap-2"
    >
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 py-2 text-base focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
      />
      <button
        type="submit"
        className="min-h-11 shrink-0 rounded-md bg-amber-500 px-4 text-sm font-semibold text-slate-900 hover:bg-amber-400"
      >
        Open
      </button>
    </form>
  );
}
