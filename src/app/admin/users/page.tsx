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
        <Link
          href="/admin/users/new"
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
        >
          Add person
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email / Gmail</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Sites</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.role}</td>
                <td className="px-4 py-3">{u.phone || "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {u.memberships.map((m) => m.site.code).join(", ") || "—"}
                </td>
                <td className="px-4 py-3">{u.isActive ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/users/${u.id}`} className="text-amber-700 hover:underline">
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
