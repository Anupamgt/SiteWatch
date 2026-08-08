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
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#091e4224] bg-[#1d2125] px-4 py-2.5 text-white">
      <div className="flex min-w-0 items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-base text-[#c7d1db] hover:bg-[#ffffff14] hover:text-white"
            aria-label={i18n?.t("common.back") ?? "Back"}
          >
            ←
          </Link>
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-[var(--ads-brand-product)] text-xs font-bold text-[#172b4d]">
            SW
          </div>
        )}
        <h1 className="truncate text-[15px] font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <LanguageSwitcher compact />
        {userName && (
          <span className="hidden text-sm text-[#9fadbc] sm:inline">{userName}</span>
        )}
        <SignOutButton />
      </div>
    </header>
  );
}
