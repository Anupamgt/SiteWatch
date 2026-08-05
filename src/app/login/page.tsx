import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-900 px-4 py-12">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500 text-xl font-bold text-slate-900">
            SW
          </div>
          <h1 className="text-xl font-semibold text-slate-900">SiteWatch</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to file or review site reports</p>
        </div>

        <Suspense fallback={null}>
          <LoginForm
            googleEnabled={Boolean(
              process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            )}
          />
        </Suspense>
      </div>
    </div>
  );
}
