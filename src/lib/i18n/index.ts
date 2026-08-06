/** Client-safe i18n helpers (no next/headers). */
export type { Dictionary, Locale } from "./config";
export { LOCALE_COOKIE, LOCALES, isLocale } from "./config";
export {
  DICTS,
  getDictionarySync,
  translate,
  ticketStatusLabel,
  roleLabel,
} from "./messages";
