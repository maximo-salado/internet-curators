"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = email.charAt(0).toUpperCase();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-48 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-lg">
          <div className="px-3 py-2 text-xs text-zinc-500 truncate">{email}</div>
          <div className="my-1 h-px bg-zinc-800" />
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="block rounded px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Dashboard
          </Link>
          <form action="/auth/signout" method="post">
            <button className="w-full rounded px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
