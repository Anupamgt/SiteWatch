"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Locale } from "@/lib/i18n/config";

export function LanguageSwitcher({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function setLocale(next: Locale) {
    if (next === locale) return;
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div
      className={
        className ??
        (compact
          ? "inline-flex items-center gap-1 rounded-[var(--ads-radius)] bg-[#22272b] p-0.5"
          : "inline-flex items-center gap-1 rounded-[var(--ads-radius)] border border-[var(--ads-border)] bg-[var(--ads-surface)] p-0.5")
      }
      role="group"
      aria-label={t("common.language")}
    >
      <LangBtn
        active={locale === "en"}
        pending={pending}
        onClick={() => setLocale("en")}
        compact={compact}
        label={compact ? "EN" : t("common.english")}
      />
      <LangBtn
        active={locale === "hi"}
        pending={pending}
        onClick={() => setLocale("hi")}
        compact={compact}
        label={compact ? "हिं" : t("common.hindi")}
      />
    </div>
  );
}

function LangBtn({
  active,
  pending,
  onClick,
  label,
  compact,
}: {
  active: boolean;
  pending: boolean;
  onClick: () => void;
  label: string;
  compact: boolean;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={
        compact
          ? `rounded-[var(--ads-radius-sm)] px-2 py-1 text-xs font-semibold transition ${
              active
                ? "bg-[var(--ads-brand)] text-[var(--ads-text-inverse)]"
                : "text-[#9fadbc] hover:text-white"
            }`
          : `rounded-[var(--ads-radius-sm)] px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-[var(--ads-brand)] text-[var(--ads-text-inverse)]"
                : "text-[var(--ads-text-subtle)] hover:bg-[var(--ads-neutral)]"
            }`
      }
    >
      {label}
    </button>
  );
}
