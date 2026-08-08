"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="ads-flag ads-flag-error space-y-3 p-4">
      <h2 className="font-semibold text-[var(--ads-danger-bold)]">Admin error</h2>
      <p className="text-sm text-[var(--ads-danger)]">{error.message}</p>
      <button type="button" onClick={reset} className="ads-btn ads-btn-primary bg-[var(--ads-danger-bold)]">
        Retry
      </button>
    </div>
  );
}
