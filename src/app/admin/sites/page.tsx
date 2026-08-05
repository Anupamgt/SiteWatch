import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminSitesPage() {
  const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Sites</h1>
        <Link
          href="/admin/sites/new"
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
        >
          New site
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => (
              <tr key={site.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{site.name}</td>
                <td className="px-4 py-3">{site.code}</td>
                <td className="px-4 py-3 text-slate-600">{site.projectName}</td>
                <td className="px-4 py-3">{site.isActive ? "Active" : "Inactive"}</td>
                <td className="space-x-3 px-4 py-3 text-right">
                  <Link href={`/admin/sites/${site.id}`} className="text-amber-700 hover:underline">
                    Dashboard
                  </Link>
                  <Link
                    href={`/admin/sites/${site.id}/settings`}
                    className="text-slate-600 hover:underline"
                  >
                    Settings
                  </Link>
                  <Link
                    href={`/admin/sites/${site.id}/fields`}
                    className="text-slate-600 hover:underline"
                  >
                    Fields
                  </Link>
                  <Link
                    href={`/admin/sites/${site.id}/members`}
                    className="text-slate-600 hover:underline"
                  >
                    Members
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
