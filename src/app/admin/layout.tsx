import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { TopBar } from "@/components/TopBar";
import { getDictionary } from "@/lib/i18n/server";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const { dict } = await getDictionary();

  const NAV = [
    { href: "/admin", label: dict.nav.overview },
    { href: "/admin/sites", label: dict.nav.sites },
    { href: "/admin/machines", label: dict.nav.machines },
    { href: "/admin/tickets", label: dict.nav.tickets },
    { href: "/admin/users", label: dict.nav.people },
    { href: "/admin/corrective-actions", label: dict.nav.correctiveActions },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <TopBar title={`${dict.common.appName} · ${dict.nav.overview}`} userName={user.name ?? undefined} />
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 py-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
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
