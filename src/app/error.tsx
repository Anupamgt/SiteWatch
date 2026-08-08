"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="text-sm text-slate-500">{error.message || "Unexpected error"}</p>
      <button
        type="button"
        onClick={reset}
        className="ads-btn ads-btn-primary"
      >
        Try again
      </button>
    </div>
  );
}
