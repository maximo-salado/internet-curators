"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";

export function HeaderPlus() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-10 w-48 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl z-50">
          <Link href="/dashboard" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded-t-lg transition-colors">
            New collection
          </Link>
          <Link href="/dashboard?add=source" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded-b-lg transition-colors">
            Add source
          </Link>
        </div>
      )}
    </div>
  );
}
