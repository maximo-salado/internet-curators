"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FollowButton } from "@/components/FollowButton";

interface Curator {
  id: string;
  display_name: string;
  bio: string;
  follower_counts: { count: number } | null;
}

export function CuratorStrip() {
  const [curators, setCurators] = useState<Curator[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/curators")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const sorted = data.sort((a: Curator, b: Curator) =>
            (b.follower_counts?.count ?? 0) - (a.follower_counts?.count ?? 0)
          );
          setCurators(sorted.slice(0, 10));
        }
      })
      .catch(() => {});

    fetch("/api/follows")
      .then((r) => r.json())
      .then((data) => {
        if (data?.curators) {
          setFollowedIds(new Set(data.curators.map((c: any) => c.curator_id)));
        }
      })
      .catch(() => {});
  }, []);

  if (curators.length === 0) return null;

  return (
    <div className="py-4">
      <div className="px-4 mb-3">
        <h3 className="text-sm font-medium text-zinc-300">Trusted voices</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 scrollbar-hide">
        {curators.map((c) => (
          <div
            key={c.id}
            className="shrink-0 w-[160px] rounded-xl border border-zinc-800 bg-zinc-900 p-4"
          >
            <Link href={`/curator/${c.id}`} className="block">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900">
                <span className="text-lg font-semibold text-zinc-300">
                  {c.display_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <h4 className="mt-3 font-medium text-sm text-zinc-200 truncate">
                {c.display_name}
              </h4>
              {c.bio && (
                <p className="mt-1 text-xs text-zinc-500 line-clamp-1">
                  {c.bio}
                </p>
              )}
              <p className="mt-1 text-xs text-zinc-600">
                {c.follower_counts?.count ?? 0} follower{(c.follower_counts?.count ?? 0) !== 1 ? "s" : ""}
              </p>
            </Link>
            <div className="mt-2">
              <FollowButton
                targetType="curator"
                targetId={c.id}
                initialFollowed={followedIds.has(c.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
