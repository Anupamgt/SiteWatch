import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: {
      memberships: { include: { site: { select: { code: true, name: true } } } },
    },
  });

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">People</h1>
          <p className="text-sm text-slate-500">
            Manage engineers, site supervisors, and admins. Only admins can open this directory —
            supervisors cannot view org people.
          </p>
        </div>
        <Link href="/admin/users/new" className="ads-btn ads-btn-primary text-sm">
          Add person
        </Link>
      </div>

      <div className="ads-table-wrap">
        <table className="ads-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email / Gmail</th>
              <th>Role</th>
              <th>Phone</th>
              <th>Sites</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.phone || "—"}</td>
                <td className="text-[var(--ads-text-subtle)]">
                  {u.memberships.map((m) => m.site.code).join(", ") || "—"}
                </td>
                <td>{u.isActive ? "Active" : "Inactive"}</td>
                <td className="text-right">
                  <Link href={`/admin/users/${u.id}`} className="ads-link">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
