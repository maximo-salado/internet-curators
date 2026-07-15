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

  if (pathname === "/") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-black/95 backdrop-blur safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around h-14">
        {/* Discover */}
        <button onClick={() => router.push("/feed")} className="flex flex-col items-center gap-0.5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={pathname === "/feed" && currentTab !== "your" ? "#f4f4f5" : "#71717a"} strokeWidth="1.5">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 2a14 14 0 010 20M12 2a14 14 0 000 20M2 12h20"/>
          </svg>
          <span className={`text-[10px] leading-none ${pathname === "/feed" && currentTab !== "your" ? "text-zinc-100" : "text-zinc-500"}`}>Discover</span>
        </button>

        {/* Feed */}
        <button onClick={() => router.push("/feed?tab=your")} className="flex flex-col items-center gap-0.5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={pathname === "/feed" && currentTab === "your" ? "#f4f4f5" : "#71717a"} strokeWidth="1.5">
            <circle cx="6" cy="18" r="2"/><path d="M4 12a8 8 0 018 8"/><path d="M4 6a14 14 0 0114 14"/>
          </svg>
          <span className={`text-[10px] leading-none ${pathname === "/feed" && currentTab === "your" ? "text-zinc-100" : "text-zinc-500"}`}>Feed</span>
        </button>

        {/* Collections */}
        <Link href="/dashboard" className="flex flex-col items-center gap-0.5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={pathname === "/dashboard" ? "#f4f4f5" : "#71717a"} strokeWidth="1.5">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
          <span className={`text-[10px] leading-none ${pathname === "/dashboard" ? "text-zinc-100" : "text-zinc-500"}`}>Collections</span>
        </Link>

        {/* Profile */}
        <Link
          href={user && curatorId ? `/curator/${curatorId}` : "/login"}
          className="flex flex-col items-center gap-0.5"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={
            user && curatorId && pathname.startsWith("/curator/") ? "#f4f4f5" : "#71717a"
          } strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="10" r="3"/>
            <path d="M6 18c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5"/>
          </svg>
          <span className={`text-[10px] leading-none ${user && curatorId && pathname.startsWith("/curator/") ? "text-zinc-100" : "text-zinc-500"}`}>Profile</span>
        </Link>
      </div>
    </nav>
  );
}
