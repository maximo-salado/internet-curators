"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface HeaderProps {
  initialUser: User | null;
  editorPendingCount: number;
}

export function Header({ initialUser, editorPendingCount }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(initialUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const lastScrollRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHome = pathname === "/";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  const hasPending = editorPendingCount > 0;

  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY;
      if (current <= 0) {
        setVisible(true);
        return;
      }
      if (current > lastScrollRef.current) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      lastScrollRef.current = current;

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setVisible(true);
      }, 300);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // On the home page, hide the fixed header only when anonymous (hero section has its own)
  // Logged-in users on home get the header with profile menu
  if (isHome && !user) return null;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-black/95 backdrop-blur transition-transform duration-200 ${
          visible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between px-4 py-3 md:hidden">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight"
          >
            Internet Curators
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="relative flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  <span className="text-sm font-medium text-zinc-300">
                    {user.email?.charAt(0).toUpperCase() || "U"}
                  </span>
                  {hasPending && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-full" />
                  )}
                </button>
                {menuOpen && (
                  <MenuDropdown
                    user={user}
                    onClose={() => setMenuOpen(false)}
                  />
                )}
              </div>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Desktop header */}
        <nav className="hidden md:flex items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight"
          >
            Internet Curators
          </Link>

          <div className="flex items-center gap-2">
            {user ? (
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="relative flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  <span className="text-sm font-medium text-zinc-300">
                    {user.email?.charAt(0).toUpperCase() || "U"}
                  </span>
                  {hasPending && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-full" />
                  )}
                </button>
                {menuOpen && (
                  <MenuDropdown
                    user={user}
                    onClose={() => setMenuOpen(false)}
                  />
                )}
              </div>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </nav>
      </header>
      <div className="h-[49px]" />
    </>
  );
}

function MenuDropdown({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-10 w-52 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl z-50">
      <div className="px-4 py-2.5 border-b border-zinc-800">
        <p className="text-sm text-zinc-300 truncate">{user.email}</p>
      </div>
      <Link
        href="/profile"
        onClick={onClose}
        className="block px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        Settings
      </Link>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-zinc-800 rounded-b-lg transition-colors"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
