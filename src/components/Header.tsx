"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
  const [expanded, setExpanded] = useState(true);
  const expandedForSessionRef = useRef(false);
  const [visible, setVisible] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastScrollRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerTargetRef = useRef<HTMLDivElement>(null);
  const scrollStartedRef = useRef(false);

  const isHome = pathname === "/";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  const hasPending = editorPendingCount > 0;

  const tabParam = pathname === "/" ? "" : "";
  const tab = pathname === "/" ? (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") ?? "discover" : "discover") : "";

  const navigateTab = useCallback((t: string) => {
    router.push(`/?tab=${t}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY;
      if (current <= 0) {
        setVisible(true);
        return;
      }
      if (current > lastScrollRef.current) {
        setVisible(false);
        scrollStartedRef.current = true;
      } else {
        setVisible(true);
      }
      lastScrollRef.current = current;

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setVisible(true);
      }, 300);

      if (current > 50 && !expandedForSessionRef.current) {
        setExpanded(false);
        expandedForSessionRef.current = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-black/95 backdrop-blur transition-transform duration-200 ${
          visible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between px-4 py-3 md:hidden">
          <Link href="/" className="text-base font-semibold tracking-tight">
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
                {menuOpen && <MenuDropdown user={user} hasPending={hasPending} pendingCount={editorPendingCount} onClose={() => setMenuOpen(false)} />}
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>

        {/* Desktop header */}
        <nav className="hidden md:flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-base font-semibold tracking-tight">
              Internet Curators
            </Link>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateTab("discover")}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  tab === "discover" || (!tab && pathname === "/")
                    ? "text-zinc-100 underline underline-offset-[12px] decoration-2 decoration-zinc-400"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Discover
              </button>
              <button
                onClick={() => navigateTab("my-feed")}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  tab === "my-feed"
                    ? "text-zinc-100 underline underline-offset-[12px] decoration-2 decoration-zinc-400"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                My Feed
              </button>
            </div>
          </div>
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
                {menuOpen && <MenuDropdown user={user} hasPending={hasPending} pendingCount={editorPendingCount} onClose={() => setMenuOpen(false)} />}
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      </header>
      <div className={`md:h-[49px] ${!user && expanded ? "h-[88px]" : "h-[57px]"}`} />
    </>
  );
}

function MenuDropdown({
  user,
  hasPending,
  pendingCount,
  onClose,
}: {
  user: User;
  hasPending: boolean;
  pendingCount: number;
  onClose: () => void;
}) {
  const [isEditor, setIsEditor] = useState(false);

  useEffect(() => {
    fetch("/api/discover/sources?status=pending&limit=1")
      .then((r) => r.json())
      .then((data) => { if (data.isEditor) setIsEditor(true); })
      .catch(() => {});
  }, []);

  return (
    <div className="absolute right-0 top-10 w-52 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl z-50">
      <div className="px-4 py-2.5 border-b border-zinc-800">
        <p className="text-sm text-zinc-300 truncate">{user.email}</p>
      </div>
      {isEditor && (
        <Link
          href="/review-queue"
          onClick={onClose}
          className="flex items-center justify-between px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <span>Review Queue</span>
          {hasPending && (
            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-400">
              {pendingCount}
            </span>
          )}
        </Link>
      )}
      <Link
        href="/dashboard"
        onClick={onClose}
        className="block px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        My Collections
      </Link>
      {isEditor && (
        <Link
          href="/tag-health"
          onClick={onClose}
          className="block px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          Tag Health
        </Link>
      )}
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
