import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { TopBar } from "@/components/TopBar";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/sites", label: "Sites" },
  { href: "/admin/machines", label: "Machines" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/users", label: "People" },
  { href: "/admin/corrective-actions", label: "Corrective Actions" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <TopBar title="SiteWatch Admin" userName={user.name ?? undefined} />
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 py-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</div>
    </div>
  );
}
