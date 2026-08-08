import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminSitesPage() {
  const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Sites</h1>
        <Link href="/admin/sites/new" className="ads-btn ads-btn-primary text-sm">
          New site
        </Link>
      </div>

      <div className="ads-table-wrap">
        <table className="ads-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Project</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => (
              <tr key={site.id}>
                <td className="font-medium">{site.name}</td>
                <td>{site.code}</td>
                <td className="text-[var(--ads-text-subtle)]">{site.projectName}</td>
                <td>{site.isActive ? "Active" : "Inactive"}</td>
                <td className="space-x-3 text-right">
                  <Link href={`/admin/sites/${site.id}`} className="ads-link">
                    Dashboard
                  </Link>
                  <Link
                    href={`/admin/sites/${site.id}/settings`}
                    className="ads-link text-[var(--ads-text-subtle)]"
                  >
                    Settings
                  </Link>
                  <Link
                    href={`/admin/sites/${site.id}/fields`}
                    className="ads-link text-[var(--ads-text-subtle)]"
                  >
                    Fields
                  </Link>
                  <Link
                    href={`/admin/sites/${site.id}/members`}
                    className="ads-link text-[var(--ads-text-subtle)]"
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
