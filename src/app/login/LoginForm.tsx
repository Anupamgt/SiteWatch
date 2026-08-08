"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PasswordInput } from "@/components/PasswordInput";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    oauthError ? t("login.googleFailed") : null,
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (!result || result.error) {
      setError(t("login.invalidCreds"));
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="ads-label">
            {t("login.email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ads-input min-h-12 text-base"
          />
        </div>

        <PasswordInput
          id="password"
          label={t("login.password")}
          value={password}
          onChange={setPassword}
          required
          showLabel={t("login.showPassword")}
          hideLabel={t("login.hidePassword")}
        />

        {error && (
          <p className="ads-flag ads-flag-error px-3 py-2 text-sm text-[var(--ads-danger)]" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="ads-btn ads-btn-primary min-h-12 w-full text-base"
        >
          {loading ? t("common.loading") : t("login.signIn")}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="relative py-1 text-center text-xs uppercase tracking-wide text-[var(--ads-text-subtlest)]">
            <span className="bg-[var(--ads-surface)] px-2">—</span>
          </div>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="ads-btn ads-btn-default min-h-12 w-full text-base"
          >
            {t("login.signInGoogle")}
          </button>
        </>
      )}
    </div>
  );
}
