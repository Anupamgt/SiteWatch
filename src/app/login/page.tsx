import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { getDictionary } from "@/lib/i18n/server";

export default async function LoginPage() {
  const { dict } = await getDictionary();

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-[var(--ads-surface-sunken)] px-4 py-12">
      <div className="ads-surface w-full max-w-sm p-6 sm:p-8">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[var(--ads-radius)] bg-[var(--ads-brand-product)] text-xl font-bold text-[var(--ads-text)]">
            SW
          </div>
          <h1 className="ads-page-title text-xl">{dict.common.appName}</h1>
          <p className="ads-page-subtitle">{dict.login.subtitle}</p>
        </div>

        <Suspense fallback={null}>
          <LoginForm
            googleEnabled={Boolean(
              process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
            )}
          />
        </Suspense>
      </div>
    </div>
  );
}
