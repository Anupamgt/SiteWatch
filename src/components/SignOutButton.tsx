"use client";

import { signOut } from "next-auth/react";
import { useI18nOptional } from "@/components/i18n/I18nProvider";

export function SignOutButton({ className }: { className?: string }) {
  const i18n = useI18nOptional();
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={
        className ??
        "ads-btn ads-btn-subtle min-h-8 px-2 text-sm text-[#c7d1db] hover:bg-[#ffffff14] hover:text-white"
      }
    >
      {i18n?.t("common.signOut") ?? "Sign out"}
    </button>
  );
}
