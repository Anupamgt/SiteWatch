"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { Dictionary, Locale } from "@/lib/i18n/config";
import { translate, ticketStatusLabel, roleLabel } from "@/lib/i18n";

type I18nContextValue = {
  locale: Locale;
  dict: Dictionary;
  t: (key: string, fallback?: string) => string;
  ticketStatus: (status: string) => string;
  roleName: (role: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
}) {
  const t = useCallback(
    (key: string, fallback?: string) => translate(dict, key, fallback),
    [dict],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dict,
      t,
      ticketStatus: (status: string) => ticketStatusLabel(dict, status),
      roleName: (role: string) => roleLabel(dict, role),
    }),
    [locale, dict, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

/** Safe hook for components that may render outside provider (fallback to key). */
export function useI18nOptional(): I18nContextValue | null {
  return useContext(I18nContext);
}
