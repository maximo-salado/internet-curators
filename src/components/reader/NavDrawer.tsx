"use client";

import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NavDrawer({ open, onClose }: NavDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer — slides from left */}
      <div
        ref={drawerRef}
        className={`fixed inset-y-0 left-0 z-50 w-full max-w-sm border-r border-zinc-800 bg-zinc-950 shadow-2xl overflow-y-auto transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="px-5 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold tracking-tight text-white">
                RSSMag
              </span>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Close navigation"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-5 border-t border-zinc-800" />

          {/* Nav links */}
          <div className="flex-1 px-5 py-5 space-y-5">
            {/* About RSSMag */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                About RSSMag
              </h3>
              <p className="text-xs leading-relaxed text-zinc-500">
                An alternative tech magazine. Independent voices, underrated
                writers, comics, weird indie sites — anywhere critical thinking
                meets technology and how it touches everything. No algorithms,
                no hate — just curated human taste. New issue every day. 20
                articles, start to finish.
              </p>
            </div>

            {/* Contribute */}
            <a
              href="mailto:contribute@rssmag.io"
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Contribute a source
            </a>

            {/* GitHub */}
            <a
              href="https://github.com/maximo-salado/internet-curators"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
