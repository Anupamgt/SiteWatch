import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">
        🚫
      </div>
      <h1 className="text-xl font-semibold text-slate-900">Access denied</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Your account does not have permission to view this page.
      </p>
      <Link
        href="/"
        className="ads-btn ads-btn-primary mt-6 min-h-11"
      >
        Back to home
      </Link>
    </div>
  );
}
