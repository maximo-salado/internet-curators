"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderPlus } from "@/components/HeaderPlus";

export function Header() {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  if (isLanding) {
    return (
      <header className="border-b border-zinc-800">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-base font-semibold tracking-tight">
              Internet Curators
            </Link>
            <Link href="/feed" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              App →
            </Link>
          </div>
          <Link href="/signup" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
            Sign up
          </Link>
        </nav>
      </header>
    );
  }

  return (
    <header className="border-b border-zinc-800">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="w-10">
          <HeaderPlus />
        </div>
        <Link href="/" className="text-base font-semibold tracking-tight">
          Internet Curators
        </Link>
        <div className="w-10 flex justify-end">
          <Link href="/search" className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7"/>
              <path d="M16.5 16.5L21 21"/>
            </svg>
          </Link>
        </div>
      </nav>
    </header>
  );
}
