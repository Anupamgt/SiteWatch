"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Person = { id: string; name: string; email: string; role: string };

export function MembersManager({
  siteId,
  members,
  candidates,
}: {
  siteId: string;
  members: Person[];
  candidates: Person[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const memberIds = new Set(members.map((m) => m.id));

  async function add() {
    if (!userId) return;
    await fetch(`/api/sites/${siteId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setUserId("");
    router.refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/sites/${siteId}/members/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-lg border bg-white">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-medium">
                {m.name}{" "}
                <span className="text-slate-400">({m.role})</span>
              </p>
              <p className="text-slate-500">{m.email}</p>
            </div>
            <button type="button" onClick={() => remove(m.id)} className="text-red-600 hover:underline">
              Remove
            </button>
          </li>
        ))}
        {members.length === 0 && (
          <li className="px-4 py-3 text-sm text-slate-500">No members yet</li>
        )}
      </ul>

      <div className="flex flex-wrap gap-2">
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="min-h-11 min-w-[16rem] rounded-md border px-3"
        >
          <option value="">Select person…</option>
          {candidates
            .filter((c) => !memberIds.has(c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
        </select>
        <button
          type="button"
          onClick={add}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold"
        >
          Add member
        </button>
      </div>
    </div>
  );
}
