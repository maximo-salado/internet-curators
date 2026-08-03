"use client";

import type { DaySlot } from "@/lib/weeks";

interface CoverCardProps {
  day: DaySlot;
  isFinished: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>, issueNumber: number) => void;
}

export default function CoverCard({ day, isFinished, onClick }: CoverCardProps) {
  const { issue, label, isToday, isFuture } = day;

  if (!issue) {
    return (
      <div className="relative flex flex-col items-center justify-center w-full rounded-lg border border-dashed border-zinc-800/70 bg-zinc-900/50 aspect-[2/3] opacity-80">
        <span className="text-xs text-zinc-500 uppercase">{label}</span>
        <span className="text-xs text-zinc-600 mt-0.5">
          {isFuture ? "" : "no issue"}
        </span>
      </div>
    );
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick(e, issue.number);
  };

  return (
    <button
      onClick={handleClick}
      data-issue-number={issue.number}
      className={`relative flex flex-col items-center justify-end w-full rounded-lg border transition-all overflow-hidden aspect-[2/3]
        ${isToday
          ? "border-zinc-400/50 bg-zinc-900"
          : isFinished
          ? "border-zinc-500/30 bg-zinc-900/80"
          : "border-zinc-800/60 bg-zinc-950"
        }
        hover:border-zinc-600`}
    >
      {issue.leadImage ? (
        <img
          src={issue.leadImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-25"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800/50">
          <span className="font-serif font-bold text-3xl sm:text-4xl text-zinc-600 select-none">
            #{issue.number}
          </span>
        </div>
      )}

      <span className="absolute top-1.5 left-2 text-xs font-medium text-zinc-500 uppercase">
        {label}
      </span>

      <div className="relative z-10 flex flex-col items-center gap-1 pb-3 px-2">
        <span className={`font-serif font-bold text-sm ${isFinished ? "text-zinc-200" : "text-zinc-400"}`}>
          #{issue.number}
        </span>
        <span className="text-xs text-zinc-500">
          {issue.count} {issue.count === 1 ? "art" : "arts"}
        </span>
      </div>

      {isToday && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-400/60 rounded-b-lg" />
      )}

      {isFinished && !isToday && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-500/30 rounded-b-lg" />
      )}
    </button>
  );
}
