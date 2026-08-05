"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const oauthError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    oauthError
      ? "Google sign-in failed. Your Gmail must already be registered as an active user by an admin."
      : null
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
      setError("Invalid email or password.");
      return;
    }

    // Always land on "/" so the server can role-route (admin → /admin, engineer → /sites).
    // Trusting callbackUrl alone can send an engineer to /admin → 403 after an admin session.
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="min-h-11 w-full rounded-md bg-amber-500 px-4 py-2 text-base font-semibold text-slate-900 transition-colors hover:bg-amber-400 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="relative py-1 text-center text-xs uppercase tracking-wide text-slate-400">
            <span className="bg-white px-2">or</span>
          </div>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-800 hover:bg-slate-50"
          >
            Continue with Google
          </button>
          <p className="text-center text-xs text-slate-500">
            Your Google account email must match a user created by an admin.
          </p>
        </>
      )}
    </div>
  );
}
