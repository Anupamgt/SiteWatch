import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { getDictionary } from "@/lib/i18n/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SiteWatch",
  description: "Daily Progress Report system for construction sites",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, dict } = await getDictionary();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${notoDevanagari.variable} h-full antialiased`}
    >
      <body
        className={`min-h-full flex flex-col bg-slate-50 text-slate-900 ${
          locale === "hi" ? "font-[family-name:var(--font-noto-devanagari),var(--font-geist-sans),sans-serif]" : ""
        }`}
      >
        <I18nProvider locale={locale} dict={dict}>
          <Providers>{children}</Providers>
        </I18nProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
