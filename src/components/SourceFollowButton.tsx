"use client";

import { useCallback, useSyncExternalStore } from "react";

interface SourceFollowButtonProps {
  sourceId: string;
  isLoggedIn: boolean;
}

export function SourceFollowButton({ sourceId, isLoggedIn }: SourceFollowButtonProps) {
  const getSnapshot = useCallback(
    () => {
      const stored = JSON.parse(localStorage.getItem("ic:followed-sources") ?? "[]") as string[];
      return String(stored.includes(sourceId));
    },
    [sourceId],
  );

  const followed = useSyncExternalStore(
    (cb) => {
      window.addEventListener("ic:followed-sources-updated", cb);
      return () => window.removeEventListener("ic:followed-sources-updated", cb);
    },
    getSnapshot,
    () => "false",
  ) === "true";

  const toggle = () => {
    if (!isLoggedIn) return;

    const stored: string[] = JSON.parse(localStorage.getItem("ic:followed-sources") ?? "[]");
    const next = followed
      ? stored.filter((id) => id !== sourceId)
      : [...stored, sourceId];
    localStorage.setItem("ic:followed-sources", JSON.stringify(next));
    window.dispatchEvent(new Event("ic:followed-sources-updated"));
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
