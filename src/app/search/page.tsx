import Link from "next/link";

export default function SearchPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 mb-16 text-center">
      <h1 className="text-2xl font-semibold mb-4">Search</h1>
      <p className="text-zinc-400 mb-6">
        Search curators, sources, and articles across Internet Curators.
      </p>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search..."
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <p className="text-xs text-zinc-600">
          Full search coming soon.{" "}
          <Link href="/" className="text-zinc-400 hover:text-zinc-300 underline">
            Back to Discover
          </Link>
        </p>
      </div>
    </main>
  );
}
