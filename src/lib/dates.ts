import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "./constants";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns true only for a strict YYYY-MM-DD string. */
export function isValidDateParam(value: string | undefined | null): value is string {
  if (!value || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Parses a bare YYYY-MM-DD string into a UTC-midnight Date suitable for a
 * Prisma `@db.Date` column. We never let the local Node process timezone
 * interfere — the string is the source of truth for the calendar date.
 */
export function parseDateOnly(value: string): Date {
  if (!isValidDateParam(value)) {
    throw new Error(`Invalid date: ${value}`);
  }
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Formats a Date (or db.Date value) back to YYYY-MM-DD, ignoring local TZ. */
export function formatDateOnly(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Day-of-week name computed from a bare YYYY-MM-DD, pinned to UTC (never the
 * local Node process timezone) so it can't drift by a day. */
export function dayOfWeekFromDateOnly(value: string): string {
  const date = parseDateOnly(value);
  return WEEKDAYS[date.getUTCDay()];
}

/** Today's calendar date (YYYY-MM-DD) as observed in APP_TIMEZONE. */
export function todayInAppTimezone(): string {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
}

/** Start-of-today (date-only, UTC-midnight) in APP_TIMEZONE, for overdue comparisons. */
export function startOfTodayInAppTimezone(): Date {
  return parseDateOnly(todayInAppTimezone());
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Human-friendly display, e.g. "05-Aug-2026". Reads UTC fields so a bare
 * date-only value never shifts by a day under a local timezone offset. */
export function formatDisplayDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}
