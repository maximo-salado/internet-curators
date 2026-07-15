"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Curator {
  id: string;
  display_name: string;
}

export function CuratorStories() {
  const [curators, setCurators] = useState<Curator[]>([]);

  useEffect(() => {
    fetch("/api/curators")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCurators(data.slice(0, 10));
      })
      .catch(() => {});
  }, []);

  if (curators.length === 0) return null;

  return (
    <div className="border-b border-zinc-800">
      <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-hide">
        {curators.map((c) => (
          <Link
            key={c.id}
            href={`/curator/${c.id}`}
            className="flex shrink-0 flex-col items-center gap-1 w-16"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 p-0.5">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-black">
                <span className="text-lg font-semibold text-zinc-300">
                  {c.display_name.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <span className="text-[11px] text-zinc-400 truncate w-full text-center leading-tight">
              {c.display_name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
