import { NextRequest, NextResponse } from "next/server";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";

const useSecure =
  (process.env.NEXTAUTH_URL ?? "").startsWith("https://") ||
  process.env.NODE_ENV === "production";

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const locale = json?.locale;
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: useSecure,
    httpOnly: false, // readable by client language switcher if needed
  });
  return res;
}
