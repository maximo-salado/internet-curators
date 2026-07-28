"use client";

import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";
import type { Page, FeedItem, Tag } from "@/lib/compose-pages";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TocDrawerProps {
  pages: Page[];
  issueNumber: number;
  issueDate: string;
  currentIndex: number;
  onNavigate: (index: number) => void;
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format an ISO date string to "Month Day, Year" (e.g. "July 28, 2026").
 */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a list of topic names joined by commas.
 */
function formatTopics(topics: { name: string }[]): string {
  const names = topics.map((t) => t.name);
  return names.join(", ");
}

/**
 * Narrowed page entry for ToC rendering — only article and section pages.
 */
type TocEntry =
  | { type: "section"; topics: Tag[]; index: number }
  | { type: "article"; item: FeedItem; index: number };

/**
 * Filter pages to only show article and section pages, skipping
 * cover / context / editor / closing. Returns TocEntry[] with
 * original indices preserved for onNavigate.
 */
function filteredPages(pages: Page[]): TocEntry[] {
  const result: TocEntry[] = [];
  pages.forEach((page, index) => {
    if (page.type === "section") {
      result.push({ type: "section", topics: page.topics, index });
    } else if (page.type === "article") {
      result.push({ type: "article", item: page.item, index });
    }
  });
  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TocDrawer({
  pages,
  issueNumber,
  issueDate,
  currentIndex,
  onNavigate,
  open,
  onClose,
}: TocDrawerProps) {
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

  const entries = filteredPages(pages);

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

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed inset-x-0 top-0 z-50 w-full max-h-[90vh] border-zinc-800 bg-zinc-950 shadow-2xl rounded-b-2xl overflow-y-auto transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="px-5 pt-6 pb-4">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-lg font-bold tracking-tight text-white">
                  RSSMag
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-zinc-400">
                    Issue #{issueNumber}
                  </span>
                  <span className="text-xs text-zinc-600">·</span>
                  <span className="text-xs text-zinc-500">
                    {formatDate(issueDate)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Close table of contents"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-5 border-t border-zinc-800" />

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <ul className="space-y-0.5">
              {entries.map((entry) => {
                if (entry.type === "section") {
                  return (
                    <li key={entry.index} className="pt-3 pb-1 first:pt-0">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {formatTopics(entry.topics)}
                      </span>
                    </li>
                  );
                }

                // article
                const isCurrent = entry.index === currentIndex;
                return (
                  <li key={entry.index}>
                    <button
                      type="button"
                      onClick={() => onNavigate(entry.index)}
                      className={`block w-full rounded px-2 py-1.5 pl-4 text-left text-sm leading-snug transition-colors ${
                        isCurrent
                          ? "bg-zinc-800 text-white"
                          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                      }`}
                    >
                      {entry.item.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

        </div>
      </div>
    </>
  );
}
