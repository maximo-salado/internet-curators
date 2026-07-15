"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Props {
  user: boolean;
  curatorId?: string;
}

export function BottomNav({ user, curatorId }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");

  const isActive = (href: string) => {
    if (href === "/search") return pathname === "/search";
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/?tab=your") return pathname === "/" && currentTab === "your";
    if (href === "/") return pathname === "/" && currentTab !== "your";
    return pathname === href;
  };

  const handleTab = (tab: string) => {
    router.push(`/?tab=${tab}`);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-black/95 backdrop-blur safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around h-14">
        <button onClick={() => router.push("/feed?tab=feed")} className="flex flex-col items-center gap-0.5">
          <HomeIcon active={pathname === "/feed" && currentTab !== "your"} />
          <span className={`text-[10px] leading-none ${pathname === "/feed" && currentTab !== "your" ? "text-zinc-100" : "text-zinc-500"}`}>Feed</span>
        </button>
        <Link href="/search" className="flex flex-col items-center gap-0.5">
          <SearchIcon active={pathname === "/search"} />
          <span className={`text-[10px] leading-none ${pathname === "/search" ? "text-zinc-100" : "text-zinc-500"}`}>Search</span>
        </Link>
        {user && (
          <>
            <button onClick={() => router.push("/feed?tab=your")} className="flex flex-col items-center gap-0.5">
              <PersonIcon active={pathname === "/feed" && currentTab === "your"} />
              <span className={`text-[10px] leading-none ${pathname === "/feed" && currentTab === "your" ? "text-zinc-100" : "text-zinc-500"}`}>You</span>
            </button>
            <Link href="/dashboard" className="flex flex-col items-center gap-0.5">
              <GearIcon active={pathname === "/dashboard"} />
              <span className={`text-[10px] leading-none ${pathname === "/dashboard" ? "text-zinc-100" : "text-zinc-500"}`}>Dashboard</span>
            </Link>
            <Link href={curatorId ? `/curator/${curatorId}` : "/login"} className="flex flex-col items-center gap-0.5">
              <ProfileIcon active={!!curatorId && pathname === `/curator/${curatorId}`} />
              <span className={`text-[10px] leading-none ${curatorId && pathname === `/curator/${curatorId}` ? "text-zinc-100" : "text-zinc-500"}`}>Profile</span>
            </Link>
          </>
        )}
        {!user && (
          <Link href="/login" className="flex flex-col items-center gap-0.5">
            <SignInIcon active={false} />
            <span className="text-[10px] leading-none text-zinc-500">Sign In</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

/* --- Icons --- */

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#f4f4f5" : "#71717a"} strokeWidth="1.5">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
    </svg>
  );
}

function SearchIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#f4f4f5" : "#71717a"} strokeWidth="1.5">
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5L21 21" />
    </svg>
  );
}

function PersonIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#f4f4f5" : "#71717a"} strokeWidth="1.5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function GearIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#f4f4f5" : "#71717a"} strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#f4f4f5" : "#71717a"} strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6 18c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" />
    </svg>
  );
}

function SignInIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#f4f4f5" : "#71717a"} strokeWidth="1.5">
      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}
