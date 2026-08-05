import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link href="/" className="text-amber-700 hover:underline">
        Go home
      </Link>
    </div>
  );
}
