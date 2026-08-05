"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={className ?? "text-sm font-medium text-slate-300 hover:text-white"}
    >
      Sign out
    </button>
  );
}
