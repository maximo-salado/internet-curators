"use client";

import { useRef, useState, useEffect } from "react";

export function ProfileMenu() {
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-40 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl z-50">
          <button onClick={() => setOpen(false)} className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 rounded-t-lg transition-colors">
            Settings
          </button>
          <button onClick={() => setOpen(false)} className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
            Account
          </button>
          <form action="/auth/signout" method="post">
            <button type="submit" className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-zinc-800 rounded-b-lg transition-colors">
              Logout
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
