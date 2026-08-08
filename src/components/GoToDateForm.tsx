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
        className="ads-input min-h-11 flex-1 text-base"
      />
      <button type="submit" className="ads-btn ads-btn-primary min-h-11 shrink-0 text-sm">
        Open
      </button>
    </form>
  );
}
