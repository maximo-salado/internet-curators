"use client";

import Link from "next/link";

export interface TopSource {
  id: string;
  title: string;
  site_url: string;
  description?: string;
}

interface TopSourcesProps {
  sources: TopSource[];
}

export function TopSources({ sources }: TopSourcesProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="py-4">
      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
        Top Sources
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
        {sources.map((source) => (
          <Link
            key={source.id}
            href={`/source/${source.id}`}
            className="shrink-0 w-40 snap-start rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 hover:border-zinc-700 hover:bg-zinc-900 transition-colors"
          >
            {/* Favicon / initial */}
            <div className="flex items-center gap-2 mb-1.5">
              <img
                src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(source.site_url)}&sz=32`}
                alt=""
                className="w-5 h-5 rounded"
                loading="lazy"
                onError={(e) => {
                  // Hide broken favicon, initial letter is shown by parent text
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="text-xs font-medium text-zinc-300 truncate">
                {source.title}
              </span>
            </div>
            {source.description && (
              <p className="text-[11px] text-zinc-500 line-clamp-2 leading-snug">
                {source.description}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
