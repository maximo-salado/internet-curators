"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [follows, setFollows] = useState<{ curators: any[]; sources: any[] }>({ curators: [], sources: [] });

  useEffect(() => {
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (!data.user) {
          router.push("/login");
          return;
        }
        setUser(data.user);
      });
    });

    fetch("/api/follows")
      .then((r) => r.json())
      .then((data) => setFollows(data))
      .catch(() => {});
  }, [router]);

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="text-zinc-400">Loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 mb-16">
      <h1 className="text-2xl font-semibold">Profile</h1>

      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
            <span className="text-xl font-semibold text-zinc-300">
              {user.email?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
          <div>
            <p className="text-lg text-zinc-200">{user.email}</p>
            <p className="text-sm text-zinc-500">
              {follows.curators.length} curator follows · {follows.sources.length} source follows
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <Link href="/dashboard" className="block rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors">
          <p className="font-medium text-zinc-200">My Collections</p>
          <p className="text-sm text-zinc-500">Manage your curated collections and sources</p>
        </Link>
      </div>

      <form action="/auth/signout" method="post" className="mt-6">
        <button
          type="submit"
          className="rounded-lg bg-zinc-800 px-6 py-2.5 text-sm font-medium text-red-400 hover:bg-zinc-700 transition-colors"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
