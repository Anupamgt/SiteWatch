import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale, type Dictionary, type Locale } from "./config";
import { getDictionarySync } from "./messages";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const raw = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(raw) ? raw : "en";
}

export async function getDictionary(): Promise<{ locale: Locale; dict: Dictionary }> {
  const locale = await getLocale();
  return { locale, dict: getDictionarySync(locale) };
}

export { getDictionarySync, translate, ticketStatusLabel, roleLabel } from "./messages";
