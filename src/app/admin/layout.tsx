import { requireAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  if (!user) redirect("/");

  return (
    <div className="min-h-full bg-black text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <Link
          href="/admin"
          className="text-sm font-semibold text-zinc-100 hover:text-white transition-colors"
        >
          Admin
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            &larr; Back to site
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
