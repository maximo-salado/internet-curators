import type { Page } from "@/lib/compose-pages";

export default function CoverPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-black text-zinc-100 select-none">
      {/* Magazine identity */}
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-6xl sm:text-7xl font-serif font-bold tracking-tight">
          RSSMag
        </h1>
        <p className="max-w-xs text-center text-sm sm:text-base text-zinc-400 leading-relaxed">
          Alternative &amp; independent voices, underrated writers, critical thinking about
          technology.
        </p>
      </div>

      {/* Swipe hint */}
      <div className="absolute bottom-10 flex items-center gap-2 text-zinc-600 text-xs animate-pulse">
        <span>swipe to open</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
