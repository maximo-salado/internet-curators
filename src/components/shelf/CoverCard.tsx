"use client";

import { useRouter } from "next/navigation";
import type { DaySlot } from "@/lib/weeks";

interface CoverCardProps {
  day: DaySlot;
  isHero: boolean;
  isFinished: boolean;
}

export default function CoverCard({ day, isHero, isFinished }: CoverCardProps) {
  const router = useRouter();
  const { issue, label, isToday, isFuture } = day;

  // Gap cell — no issue published on this day
  if (!issue) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-800/60 ${
          isHero ? "row-span-2" : ""
        } opacity-60`}
      >
        <span className="text-xs text-zinc-500">{label}</span>
        <span className="text-[10px] text-zinc-500">
          {isFuture ? "—" : "no issue"}
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={() => router.push(`/issue/${issue.number}`)}
      className={`relative flex flex-col items-center justify-end w-full rounded-lg border transition-all overflow-hidden
        ${isHero ? "row-span-2" : ""}
        ${isToday
          ? "border-amber-600/50 bg-zinc-900"
          : isFinished
          ? "border-amber-700/30 bg-zinc-900/80"
          : "border-zinc-800/60 bg-zinc-950"
        }
        hover:border-zinc-600`}
    >
      {/* Lead image background */}
      {issue.leadImage ? (
        <img
          src={issue.leadImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-25"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
          <span
            className={`font-serif font-bold text-zinc-600 select-none ${
              isHero ? "text-7xl" : "text-4xl"
            }`}
          >
            #{typeof issue.number === "number" && issue.number % 1 !== 0
              ? issue.number.toFixed(1)
              : issue.number}
          </span>
        </div>
      )}

      {/* Day label */}
      <span className="absolute top-1.5 left-2 text-[10px] font-medium text-zinc-500 uppercase">
        {label}
      </span>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-1 pb-3 px-2">
        <span
          className={`font-serif font-bold ${
            isHero ? "text-xl" : "text-sm"
          } ${isFinished ? "text-zinc-200" : "text-zinc-400"}`}
        >
          #{typeof issue.number === "number" && issue.number % 1 !== 0
            ? issue.number.toFixed(1)
            : issue.number}
        </span>
        <span className="text-[10px] text-zinc-500">
          {issue.count} {issue.count === 1 ? "art" : "arts"}
        </span>
      </div>

      {/* Today indicator */}
      {isToday && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-600/60 rounded-b-lg" />
      )}

      {/* Finished indicator */}
      {isFinished && !isToday && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-700/30 rounded-b-lg" />
      )}
    </button>
  );
}
