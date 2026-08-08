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
        <Link href="/admin/corrective-actions/new" className="ads-btn ads-btn-primary text-sm">
          New action
        </Link>
      </div>

      <form className="ads-surface flex flex-wrap gap-3 p-3">
        <select name="siteId" defaultValue={sp.siteId || ""} className="ads-input py-2 text-sm">
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status || ""} className="ads-input py-2 text-sm">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="CLOSED">Closed</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="overdue" value="true" defaultChecked={sp.overdue === "true"} />
          Overdue only
        </label>
        <button type="submit" className="ads-btn ads-btn-primary text-sm">
          Filter
        </button>
      </form>

      <div className="ads-table-wrap">
        <table className="ads-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Site</th>
              <th>Assignee</th>
              <th>Status</th>
              <th>Due</th>
              <th>Email</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => {
              const overdue =
                a.status !== "CLOSED" && a.dueDate != null && a.dueDate.getTime() < today.getTime();
              const lastEmail = a.emails[0];
              return (
                <tr key={a.id}>
                  <td className="font-medium">{a.title}</td>
                  <td>{a.site.code}</td>
                  <td>{a.assignedTo.name}</td>
                  <td>
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
