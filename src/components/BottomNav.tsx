"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function BottomNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentTab = searchParams.get("tab") ?? "discover";

  if (pathname !== "/") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-black/95 backdrop-blur safe-bottom md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around h-14">
        <button
          onClick={() => router.push("/?tab=discover", { scroll: false })}
          className="flex flex-col items-center gap-0.5 min-h-[44px] min-w-[80px] justify-center"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={currentTab === "discover" ? "#f4f4f5" : "#71717a"} strokeWidth="1.5">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 2a14 14 0 010 20M12 2a14 14 0 000 20M2 12h20"/>
          </svg>
          <span className={`text-[10px] leading-none ${currentTab === "discover" ? "text-zinc-100" : "text-zinc-500"}`}>
            Discover
          </span>
        </button>

        <button
          onClick={() => router.push("/?tab=my-feed", { scroll: false })}
          className="flex flex-col items-center gap-0.5 min-h-[44px] min-w-[80px] justify-center"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={currentTab === "my-feed" ? "#f4f4f5" : "#71717a"} strokeWidth="1.5">
            <circle cx="6" cy="18" r="2"/><path d="M4 12a8 8 0 018 8"/><path d="M4 6a14 14 0 0114 14"/>
          </svg>
          <span className={`text-[10px] leading-none ${currentTab === "my-feed" ? "text-zinc-100" : "text-zinc-500"}`}>
            My Feed
          </span>
        </button>
      </div>
    </nav>
  );
}
