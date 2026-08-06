import type { Dictionary } from "./config";
import { en } from "./dictionaries/en";
import { hi } from "./dictionaries/hi";
import type { Locale } from "./config";

export const DICTS: Record<Locale, Dictionary> = {
  en: en as Dictionary,
  hi,
};

export function getDictionarySync(locale: Locale): Dictionary {
  return DICTS[locale] ?? DICTS.en;
}

/** Resolve a dotted key like "tickets.raise" from a dictionary. */
export function translate(dict: Dictionary, key: string, fallback?: string): string {
  const parts = key.split(".");
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return fallback ?? key;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : (fallback ?? key);
}

export function ticketStatusLabel(dict: Dictionary, status: string): string {
  const map = dict.tickets.statuses as Record<string, string>;
  return map[status] ?? status.replaceAll("_", " ");
}

export function roleLabel(dict: Dictionary, role: string): string {
  const map = dict.roles as Record<string, string>;
  return map[role] ?? role;
}
