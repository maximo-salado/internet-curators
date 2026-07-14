"use client";

import { useCallback, useSyncExternalStore } from "react";

interface FollowButtonProps {
  curatorId: string;
  isLoggedIn: boolean;
}

export function FollowButton({ curatorId, isLoggedIn }: FollowButtonProps) {
  const getSnapshot = useCallback(
    () => {
      const stored = JSON.parse(localStorage.getItem("ic:followed") ?? "[]") as string[];
      return String(stored.includes(curatorId));
    },
    [curatorId],
  );

  const followed = useSyncExternalStore(
    (cb) => {
      window.addEventListener("ic:followed-updated", cb);
      return () => window.removeEventListener("ic:followed-updated", cb);
    },
    getSnapshot,
    () => "false",
  ) === "true";

  const toggle = async () => {
    if (!isLoggedIn) return;

    const stored: string[] = JSON.parse(localStorage.getItem("ic:followed") ?? "[]");
    const next = followed
      ? stored.filter((id) => id !== curatorId)
      : [...stored, curatorId];
    localStorage.setItem("ic:followed", JSON.stringify(next));
    window.dispatchEvent(new Event("ic:followed-updated"));

    await fetch(`/api/followers/${curatorId}`, {
      method: followed ? "DELETE" : "POST",
    });
  };

  if (!isLoggedIn) return null;

  return (
    <button
      onClick={toggle}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        followed
          ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
      }`}
    >
      {followed ? "Following" : "Follow"}
    </button>
  );
}
