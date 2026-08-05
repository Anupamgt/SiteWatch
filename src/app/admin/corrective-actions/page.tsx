import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateOnly, startOfTodayInAppTimezone } from "@/lib/dates";
import { StatusBadge } from "@/components/StatusBadge";
import { ResendEmailButton } from "@/components/admin/ResendEmailButton";

export default async function CorrectiveActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string; status?: string; overdue?: string }>;
}) {
  const sp = await searchParams;
  const today = startOfTodayInAppTimezone();
  const sites = await prisma.site.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  const actions = await prisma.correctiveAction.findMany({
    where: {
      ...(sp.siteId ? { siteId: sp.siteId } : {}),
      ...(sp.status ? { status: sp.status as "OPEN" | "IN_PROGRESS" | "CLOSED" } : {}),
      ...(sp.overdue === "true"
        ? { status: { not: "CLOSED" }, dueDate: { lt: today } }
        : {}),
    },
    include: {
      site: true,
      assignedTo: true,
      emails: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Corrective actions</h1>
        <Link
          href="/admin/corrective-actions/new"
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold"
        >
          New action
        </Link>
      </div>

      <form className="flex flex-wrap gap-3 rounded-lg border bg-white p-3">
        <select name="siteId" defaultValue={sp.siteId || ""} className="rounded-md border px-3 py-2 text-sm">
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status || ""} className="rounded-md border px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="CLOSED">Closed</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="overdue" value="true" defaultChecked={sp.overdue === "true"} />
          Overdue only
        </label>
        <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Site</th>
              <th className="px-3 py-2 text-left">Assignee</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Due</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => {
              const overdue =
                a.status !== "CLOSED" && a.dueDate != null && a.dueDate.getTime() < today.getTime();
              const lastEmail = a.emails[0];
              return (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{a.title}</td>
                  <td className="px-3 py-2">{a.site.code}</td>
                  <td className="px-3 py-2">{a.assignedTo.name}</td>
                  <td className="px-3 py-2">
                    {overdue ? <StatusBadge value="OVERDUE" /> : <StatusBadge value={a.status} />}
                  </td>
                  <td className="px-3 py-2">{a.dueDate ? formatDateOnly(a.dueDate) : "—"}</td>
                  <td className="px-3 py-2">
                    {lastEmail ? (
                      <span className={lastEmail.status === "FAILED" ? "text-red-700" : "text-green-700"}>
                        {lastEmail.status}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {lastEmail?.status === "FAILED" && <ResendEmailButton id={a.id} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
