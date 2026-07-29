"use client";

import { useRouter } from "next/navigation";

interface CoverCardProps {
  number: number;
  date: string; // "Jul 29"
  count: number;
  leadImage: string | null;
  isToday: boolean;
  isFinished: boolean;
}

export default function CoverCard({
  number,
  date,
  count,
  leadImage,
  isToday,
  isFinished,
}: CoverCardProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/issue/${number}`)}
      className={`relative flex flex-col items-center justify-end w-full h-[210px] rounded-lg border transition-all ${
        isToday
          ? "border-amber-600/50 bg-zinc-900"
          : isFinished
          ? "border-zinc-700/80 bg-zinc-900/90"
          : "border-zinc-800/60 bg-zinc-950/50 opacity-80"
      } hover:border-zinc-600 hover:opacity-100`}
    >
      {/* Lead image background — fills the card, text overlays */}
      {leadImage ? (
        <img
          src={leadImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover rounded-lg opacity-30"
          loading="lazy"
        />
      ) : (
        /* Typographic fallback — subtle pattern or just the number */
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl font-serif font-bold text-zinc-800 select-none">
            #{typeof number === "number" && number % 1 !== 0
              ? number.toFixed(1)
              : number}
          </span>
        </div>
      )}

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center gap-1.5 pb-4 px-3">
        {/* Issue number */}
        <span
          className={`text-lg font-serif font-bold ${
            isFinished ? "text-zinc-200" : "text-zinc-400"
          }`}
        >
          #{typeof number === "number" && number % 1 !== 0
            ? number.toFixed(1)
            : number}
        </span>

        {/* Date */}
        <span className="text-xs text-zinc-500">{date}</span>

        {/* Article count + action label */}
        <span className="text-[10px] text-zinc-600">
          {count} {count === 1 ? "article" : "articles"}
          {isFinished ? " · revisit" : ""}
        </span>
      </div>

      {/* Today indicator — subtle amber line at bottom */}
      {isToday && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-600/60 rounded-b-lg" />
      )}

      {/* Finished indicator — warm line above the today line if both */}
      {isFinished && !isToday && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-700/30 rounded-b-lg" />
      )}
    </button>
  );
}
