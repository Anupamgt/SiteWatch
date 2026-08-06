export const LOCALE_COOKIE = "sw_locale";
export type Locale = "en" | "hi";

export const LOCALES: Locale[] = ["en", "hi"];

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "hi";
}

export type { EnDictionary as Dictionary } from "./dictionaries/en";
