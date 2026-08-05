"use client";

import { useEffect } from "react";

/** Registers the app-shell service worker (public/sw.js) once on mount.
 * A tiny client component so `app/layout.tsx` can stay a Server Component. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // avoid caching during `next dev`
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability shouldn't block the app if registration fails.
    });
  }, []);
  return null;
}
