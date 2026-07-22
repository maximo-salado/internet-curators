"use client";

import { useCallback, useState } from "react";

interface FollowButtonProps {
  targetType: "curator" | "source";
  targetId: string;
  initialFollowed: boolean;
}

export function FollowButton({ targetType, targetId, initialFollowed }: FollowButtonProps) {
  const [followed, setFollowed] = useState(initialFollowed);
  const [followId, setFollowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    const prev = followed;
    setFollowed(!prev);

    try {
      if (prev) {
        const deleteParam = followId
          ? `id=${followId}`
          : targetType === "curator"
            ? `curator_id=${targetId}`
            : `source_id=${targetId}`;
        const res = await fetch(`/api/follows?${deleteParam}`, { method: "DELETE" });
        if (!res.ok) {
          setFollowed(prev);
          setError("Couldn't follow — try again.");
          return;
        }
        setFollowId(null);
      } else {
        const body = targetType === "curator" ? { curator_id: targetId } : { source_id: targetId };
        const res = await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          setFollowed(prev);
          if (res.status === 409) {
            setError(null);
          } else {
            setError("Couldn't follow — try again.");
          }
          return;
        }
        const data = await res.json();
        setFollowId(data.id);
      }
    } catch {
      setFollowed(prev);
      setError("Couldn't follow — try again.");
    } finally {
      setLoading(false);
    }
  }, [followed, followId, targetType, targetId, loading]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={loading}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          followed
            ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
        }`}
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
        ) : followed ? (
          "Following"
        ) : (
          "Follow"
        )}
      </button>
      {error && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  );
}
