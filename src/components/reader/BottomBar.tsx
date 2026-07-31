"use client";

import { X } from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BottomBarProps {
  label: string;
  onTap: () => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
// A fixed bar that sits above the SwipeStack footer. Used for bookmark
// resume prompts and "newer issue available" forward navigation.
// No business logic — pure presentational.

export default function BottomBar({ label, onTap, onDismiss }: BottomBarProps) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-between bg-zinc-900/90 backdrop-blur border-t border-zinc-800 px-4 py-3">
      <button
        type="button"
        onClick={onTap}
        className="text-base text-zinc-300 hover:text-white transition-colors text-left flex-1 mr-2"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
