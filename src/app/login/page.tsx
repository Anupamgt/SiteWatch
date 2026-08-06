import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { getDictionary } from "@/lib/i18n/server";

export default async function LoginPage() {
  const { dict } = await getDictionary();

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-900 px-4 py-12">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg sm:p-8">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500 text-xl font-bold text-slate-900">
            SW
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.common.appName}</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{dict.login.subtitle}</p>
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
