"use client";

import type { ReactNode } from "react";

interface ReviewSectionProps {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  pills: ReactNode; // inline pills shown in the row header
  editor?: ReactNode; // editor content shown when expanded
}

export function ReviewSection({
  label,
  expanded,
  onToggle,
  pills,
  editor,
}: ReviewSectionProps) {
  return (
    <div className="border-b border-zinc-800">
      {/* Row header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-3 text-left hover:bg-zinc-800/30 transition-colors px-1"
      >
        <span className="text-xs text-zinc-400 w-20 shrink-0">{label}</span>
        <span className="flex-1 flex items-center gap-1.5 min-w-0">
          {pills}
        </span>
        <span className="text-[10px] text-zinc-600 ml-1">
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {/* Expanded editor content */}
      {expanded && editor && (
        <div className="px-1 pb-3 pt-1 pl-20">{editor}</div>
      )}
    </div>
  );
}
