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
        className="mt-6 inline-flex min-h-11 items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Back to home
      </Link>
    </div>
  );
}
