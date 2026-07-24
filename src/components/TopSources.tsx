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

function cleanDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export function TopSources({ sources }: TopSourcesProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="py-4">
      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
        Top Sources
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
        {sources.map((source) => (
          <Link
            key={source.id}
            href={`/source/${source.id}`}
            className="shrink-0 w-36 snap-start rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-colors flex flex-col gap-2"
          >
            {/* Icon */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(source.site_url)}&sz=32`}
              alt=""
              className="w-6 h-6 rounded"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            {/* Name */}
            <span className="text-sm font-semibold text-zinc-200 leading-tight line-clamp-2">
              {source.title}
            </span>
            {/* URL */}
            <span className="text-[11px] text-zinc-500 truncate">
              {cleanDomain(source.site_url)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
