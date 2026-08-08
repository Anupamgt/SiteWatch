import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { formatDateOnly, startOfTodayInAppTimezone } from "@/lib/dates";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { EngineerActionControls } from "@/components/EngineerActionControls";

export default async function MyCorrectiveActionsPage() {
  const user = await requireUser();
  const today = startOfTodayInAppTimezone();

  const actions = await prisma.correctiveAction.findMany({
    where: { assignedToId: user.id },
    include: { site: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  const sorted = [...actions].sort((a, b) => {
    const aOver =
      a.status !== "CLOSED" && a.dueDate != null && a.dueDate.getTime() < today.getTime() ? 0 : 1;
    const bOver =
      b.status !== "CLOSED" && b.dueDate != null && b.dueDate.getTime() < today.getTime() ? 0 : 1;
    return aOver - bOver;
  });

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title="My corrective actions" userName={user.name ?? undefined} backHref="/sites" />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-3 px-4 py-5">
        {sorted.length === 0 && (
          <p className="ads-empty text-sm">No actions assigned.</p>
        )}
        {sorted.map((a) => {
          const overdue =
            a.status !== "CLOSED" && a.dueDate != null && a.dueDate.getTime() < today.getTime();
          return (
            <article key={a.id} className="ads-surface p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-slate-900">{a.title}</h2>
                  <p className="text-sm text-slate-500">
                    {a.site.name} · due {a.dueDate ? formatDateOnly(a.dueDate) : "—"}
                  </p>
                </div>
                {overdue ? <StatusBadge value="OVERDUE" /> : <StatusBadge value={a.status} />}
              </div>
              {a.guidance && (
                <p className="mb-3 whitespace-pre-wrap text-sm text-slate-700">{a.guidance}</p>
              )}
              {a.status !== "CLOSED" && <EngineerActionControls id={a.id} status={a.status} />}
            </article>
          );
        })}
      </main>
    </div>
  );
}
