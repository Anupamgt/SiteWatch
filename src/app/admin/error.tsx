"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="font-semibold text-red-900">Admin error</h2>
      <p className="text-sm text-red-800">{error.message}</p>
      <button type="button" onClick={reset} className="rounded-md bg-red-800 px-3 py-2 text-sm text-white">
        Retry
      </button>
    </div>
  );
}
