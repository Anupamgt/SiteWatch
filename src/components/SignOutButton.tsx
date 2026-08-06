"use client";

import { signOut } from "next-auth/react";
import { useI18nOptional } from "@/components/i18n/I18nProvider";

export function SignOutButton({ className }: { className?: string }) {
  const i18n = useI18nOptional();
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={className ?? "text-sm font-medium text-slate-300 hover:text-white"}
    >
      {i18n?.t("common.signOut") ?? "Sign out"}
    </button>
  );
}
