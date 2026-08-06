"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useI18nOptional } from "@/components/i18n/I18nProvider";

export function TopBar({
  title,
  userName,
  backHref,
}: {
  title: string;
  userName?: string;
  backHref?: string;
}) {
  const i18n = useI18nOptional();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-slate-900 px-4 py-3 text-white shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label={i18n?.t("common.back") ?? "Back"}
          >
            ←
          </Link>
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500 text-sm font-bold text-slate-900">
            SW
          </div>
        )}
        <h1 className="truncate text-base font-semibold">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <LanguageSwitcher compact />
        {userName && <span className="hidden text-sm text-slate-300 sm:inline">{userName}</span>}
        <SignOutButton />
      </div>
    </header>
  );
}
