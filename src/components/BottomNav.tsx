"use client";

import { useRouter, usePathname } from "next/navigation";

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  // Show on: /, /saved, /article/[id]
  const visible =
    pathname === "/" ||
    pathname === "/saved" ||
    pathname.startsWith("/article/");

  if (!visible) return null;

  const isActive = (route: string) => {
    if (route === "/") return pathname === "/";
    return pathname === route;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-black/95 backdrop-blur safe-bottom md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around h-14">
        {/* Browse — globe icon */}
        <button
          onClick={() => router.push("/", { scroll: false })}
          className="flex flex-col items-center gap-0.5 min-h-[44px] min-w-[80px] justify-center"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isActive("/") ? "#f4f4f5" : "#71717a"}
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 2a14 14 0 010 20M12 2a14 14 0 000 20M2 12h20" />
          </svg>
          <span
            className={`text-[10px] leading-none ${
              isActive("/") ? "text-zinc-100" : "text-zinc-500"
            }`}
          >
            Browse
          </span>
        </button>

        {/* Saved — bookmark icon */}
        <button
          onClick={() => router.push("/saved", { scroll: false })}
          className="flex flex-col items-center gap-0.5 min-h-[44px] min-w-[80px] justify-center"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={isActive("/saved") ? "#f4f4f5" : "none"}
            stroke={isActive("/saved") ? "#f4f4f5" : "#71717a"}
            strokeWidth="1.5"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
          </svg>
          <span
            className={`text-[10px] leading-none ${
              isActive("/saved") ? "text-zinc-100" : "text-zinc-500"
            }`}
          >
            Saved
          </span>
        </button>
      </div>
    </nav>
  );
}
