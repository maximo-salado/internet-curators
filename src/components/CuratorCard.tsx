"use client";

import { FollowButton } from "./FollowButton";

interface Curator {
  id: string;
  display_name: string;
  bio: string;
  follower_counts: { count: number } | null;
}

interface CuratorCardProps {
  curator: Curator;
  isLoggedIn: boolean;
}

export function CuratorCard({ curator, isLoggedIn }: CuratorCardProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">{curator.display_name}</h3>
          {curator.bio && (
            <p className="mt-1 text-sm text-zinc-500">{curator.bio}</p>
          )}
          <p className="mt-2 text-xs text-zinc-600">
            {curator.follower_counts?.count ?? 0} follower
            {(curator.follower_counts?.count ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <FollowButton curatorId={curator.id} isLoggedIn={isLoggedIn} />
      </div>
    </div>
  );
}
