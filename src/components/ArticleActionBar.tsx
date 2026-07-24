"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

interface ArticleActionBarProps {
  articleId: string;
  articleLink: string;
  upvotes: number;
  downvotes: number;
  isLoggedIn: boolean;
  userActions: string[];
}

export function ArticleActionBar({
  articleId,
  articleLink,
  upvotes: initialUpvotes,
  downvotes: initialDownvotes,
  isLoggedIn,
  userActions,
}: ArticleActionBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [upCount, setUpCount] = useState(initialUpvotes);
  const [downCount, setDownCount] = useState(initialDownvotes);
  const [localActions, setLocalActions] = useState<Set<string>>(
    () => new Set(userActions)
  );
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());

  // Sync when props change (e.g. revalidation)
  useEffect(() => {
    setUpCount(initialUpvotes);
    setDownCount(initialDownvotes);
  }, [initialUpvotes, initialDownvotes]);

  useEffect(() => {
    setLocalActions(new Set(userActions));
  }, [userActions]);

  const handleAction = useCallback(
    async (action: "upvote" | "downvote" | "save" | "dismiss") => {
      // Auth gate: redirect to login if not logged in
      if (!isLoggedIn) {
        const currentUrl = pathname + (window.location.search || "");
        router.push(`/login?next=${encodeURIComponent(currentUrl)}`);
        return;
      }

      // Already processing this action
      if (actionLoading.has(action)) return;

      const currentlyActive = localActions.has(action);
      const isVote = action === "upvote" || action === "downvote";

      // Optimistic UI update
      setActionLoading((prev) => new Set(prev).add(action));

      const prevUpCount = upCount;
      const prevDownCount = downCount;

      setLocalActions((prev) => {
        const next = new Set(prev);
        if (currentlyActive) {
          next.delete(action);
        } else {
          // For votes, remove the opposite action
          if (action === "upvote") {
            next.delete("downvote");
            setUpCount(
              (c) => (prev.has("downvote") ? c - 1 : c) + 1
            );
            setDownCount((c) => (prev.has("downvote") ? c - 1 : c));
          } else if (action === "downvote") {
            next.delete("upvote");
            setDownCount(
              (c) => (prev.has("upvote") ? c - 1 : c) + 1
            );
            setUpCount((c) => (prev.has("upvote") ? c - 1 : c));
          }
          next.add(action);
        }

        // If toggling off a vote, decrement count
        if (isVote && currentlyActive) {
          if (action === "upvote") setUpCount((c) => c - 1);
          if (action === "downvote") setDownCount((c) => c - 1);
        }

        return next;
      });

      try {
        const res = await fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, action, articleLink }),
        });

        if (!res.ok) {
          // Rollback on error
          setLocalActions((prev) => {
            const next = new Set(prev);
            if (currentlyActive) {
              next.add(action);
            } else {
              next.delete(action);
            }
            return next;
          });
          setUpCount(prevUpCount);
          setDownCount(prevDownCount);
        }
      } catch {
        // Rollback on network error
        setLocalActions((prev) => {
          const next = new Set(prev);
          if (currentlyActive) {
            next.add(action);
          } else {
            next.delete(action);
          }
          return next;
        });
        setUpCount(prevUpCount);
        setDownCount(prevDownCount);
      } finally {
        setActionLoading((prev) => {
          const next = new Set(prev);
          next.delete(action);
          return next;
        });
      }
    },
    [isLoggedIn, articleId, articleLink, actionLoading, localActions, upCount, downCount, pathname, router]
  );

  const isActive = (action: string) => localActions.has(action);
  const isLoading = (action: string) => actionLoading.has(action);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-black/95 backdrop-blur-sm safe-area-inset-bottom">
      <div className="mx-auto flex items-center justify-around max-w-3xl px-4 py-3">
        {/* Upvote */}
        <button
          onClick={() => handleAction("upvote")}
          disabled={isLoading("upvote")}
          className={`flex items-center gap-1.5 py-2 px-4 rounded-lg transition-colors active:scale-95 ${
            isActive("upvote")
              ? "text-green-400"
              : "text-zinc-400 hover:bg-zinc-800/50"
          }`}
          aria-label="Upvote"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={isActive("upvote") ? "#4ade80" : "none"}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 4l-8 8h5v8h6v-8h5z" />
          </svg>
          <span className="text-sm font-medium">{upCount}</span>
        </button>

        {/* Downvote */}
        <button
          onClick={() => handleAction("downvote")}
          disabled={isLoading("downvote")}
          className={`flex items-center gap-1.5 py-2 px-4 rounded-lg transition-colors active:scale-95 ${
            isActive("downvote")
              ? "text-red-400"
              : "text-zinc-400 hover:bg-zinc-800/50"
          }`}
          aria-label="Downvote"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={isActive("downvote") ? "#f87171" : "none"}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 20l8-8h-5V4H9v8H4z" />
          </svg>
          <span className="text-sm font-medium">{downCount}</span>
        </button>

        {/* Save */}
        <button
          onClick={() => handleAction("save")}
          disabled={isLoading("save")}
          className={`flex items-center gap-1.5 py-2 px-4 rounded-lg transition-colors active:scale-95 ${
            isActive("save")
              ? "text-yellow-400"
              : "text-zinc-400 hover:bg-zinc-800/50"
          }`}
          aria-label="Save"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={isActive("save") ? "#facc15" : "none"}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
          <span className="text-sm font-medium">
            {isActive("save") ? "Saved" : "Save"}
          </span>
        </button>

        {/* Dismiss */}
        <button
          onClick={() => handleAction("dismiss")}
          disabled={isLoading("dismiss")}
          className={`flex items-center gap-1.5 py-2 px-4 rounded-lg transition-colors active:scale-95 ${
            isActive("dismiss")
              ? "text-zinc-200 bg-zinc-800/50"
              : "text-zinc-400 hover:bg-zinc-800/50"
          }`}
          aria-label="Dismiss"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={isActive("dismiss") ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <span className="text-sm font-medium">
            {isActive("dismiss") ? "Hidden" : "Dismiss"}
          </span>
        </button>
      </div>
    </div>
  );
}
