"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceId?: string;
  feedUrl?: string;
  contentSnippet: string;
  content?: string;
  image?: string;
  upvotes?: number;
  downvotes?: number;
  tags?: { id: string; name: string; slug: string; facet: string }[];
}

interface ArticleCardProps {
  item: FeedItem;
  articleId?: string;
  onRemoveSource: (sourceTitle: string) => void;
  hidden: boolean;
  /** @deprecated — use userActions instead */
  vote?: number;
  /** @deprecated — curator feature removed */
  showAddSource?: boolean;
  compact?: boolean;
  isLoggedIn?: boolean;
  userActions?: string[];
  showRemoveAction?: boolean;
}

export function ArticleCard({
  item,
  articleId,
  onRemoveSource,
  hidden,
  vote: _vote,
  showAddSource: _showAddSource,
  compact,
  isLoggedIn = false,
  userActions = [],
  showRemoveAction = false,
}: ArticleCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [upCount, setUpCount] = useState(item.upvotes ?? 0);
  const [downCount, setDownCount] = useState(item.downvotes ?? 0);
  const [read, setRead] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Local action state for optimistic UI
  const [localActions, setLocalActions] = useState<Set<string>>(new Set(userActions));
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());

  // Sync localActions when userActions prop changes (e.g. after feed reload)
  const userActionsKey = userActions.join(",");
  useEffect(() => {
    setLocalActions(new Set(userActions));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userActionsKey]);

  // Check if already read on mount
  useEffect(() => {
    const readLinks: string[] = JSON.parse(localStorage.getItem("ic:read") ?? "[]");
    if (readLinks.includes(item.link)) setRead(true);
  }, [item.link]);

  function markRead() {
    if (read) return;
    setRead(true);
    const readLinks: string[] = JSON.parse(localStorage.getItem("ic:read") ?? "[]");
    if (!readLinks.includes(item.link)) {
      readLinks.push(item.link);
      if (readLinks.length > 1000) readLinks.splice(0, readLinks.length - 1000);
      localStorage.setItem("ic:read", JSON.stringify(readLinks));
      window.dispatchEvent(new CustomEvent("ic:article-read", { detail: { link: item.link, sourceTitle: item.sourceTitle } }));
    }
  }

  // Sync with server counts when feed reloads
  useEffect(() => {
    setUpCount(item.upvotes ?? 0);
    setDownCount(item.downvotes ?? 0);
  }, [item.upvotes, item.downvotes]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

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

      const id = articleId;
      if (!id) return; // Can't act without articleId

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
            setUpCount((c) => (prev.has("downvote") ? c - 1 : c) + 1);
            setDownCount((c) => (prev.has("downvote") ? c - 1 : c));
          } else if (action === "downvote") {
            next.delete("upvote");
            setDownCount((c) => (prev.has("upvote") ? c - 1 : c) + 1);
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
          body: JSON.stringify({ articleId: id, action, articleLink: item.link }),
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
    [isLoggedIn, articleId, actionLoading, localActions, upCount, downCount, pathname, router, item.link],
  );

  const navigateToArticle = useCallback(() => {
    markRead();
    if (articleId) {
      router.push(`/article/${articleId}`);
    } else {
      // Fallback for items without articleId (shouldn't happen in new feed)
      const params = new URLSearchParams({
        title: item.title,
        link: item.link,
        source: item.sourceTitle,
        date: item.pubDate,
        upvotes: String(upCount),
        downvotes: String(downCount),
        ...(item.content ? { content: item.content } : { snippet: item.contentSnippet }),
        ...(item.image ? { image: item.image } : {}),
      });
      router.push(`/reader?${params.toString()}`);
    }
  }, [articleId, item, upCount, downCount, router]);

  if (hidden) return null;

  const hasImage = !compact && !!item.image && !imageError;

  // --- Helper to render action button ---
  const isActive = (action: string) => localActions.has(action);
  const isLoading = (action: string) => actionLoading.has(action);

  // --- Compact variant ---
  if (compact) {
    return (
      <article ref={cardRef} className="pb-2 border-b border-zinc-800 last:border-b-0">
        <div className="flex items-start gap-1.5">
          {read && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2.5" className="mt-0.5 shrink-0">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
          <div className="min-w-0 flex-1">
            <button
              onClick={navigateToArticle}
              className="block text-left w-full"
            >
              <h3 className="text-sm font-medium text-zinc-100 leading-snug truncate">{item.title}</h3>
            </button>
            <p className="mt-0.5 text-xs text-zinc-500 truncate">
              {item.sourceTitle}
            </p>
          </div>
        </div>
      </article>
    );
  }

  // --- Full variant ---
  return (
    <article ref={cardRef} className="pb-11 border-b border-zinc-800 last:border-b-0 relative">
      {/* Image — full width */}
      {hasImage && (
        <img
          src={item.image!}
          alt=""
          className="w-full h-auto cursor-pointer"
          loading="lazy"
          onError={() => setImageError(true)}
          onClick={navigateToArticle}
        />
      )}

      {/* Text content block */}
      <div className={hasImage ? "mt-3" : ""}>
        {/* Source badge */}
        <div>
          {item.sourceId ? (
            <Link
              href={`/source/${item.sourceId}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium bg-zinc-800 text-zinc-400 hover:underline"
            >
              {item.sourceTitle}
            </Link>
          ) : (
            <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium bg-zinc-800 text-zinc-400">
              {item.sourceTitle}
            </span>
          )}
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.tags
              .filter((t) => t.facet === "topic" || t.facet === "voice")
              .slice(0, 4)
              .map((tag) => (
                <Link
                  key={tag.id}
                  href={`/feed?tags=${tag.slug}`}
                  onClick={(e) => e.stopPropagation()}
                  className={`rounded-full px-1.5 py-0.5 text-[10px] transition-colors ${
                    tag.facet === "voice"
                      ? "text-zinc-600 border border-zinc-800 hover:text-zinc-400"
                      : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                  }`}
                >
                  {tag.name}
                </Link>
              ))}
          </div>
        )}

        {/* Title + read indicator */}
        <div className="flex items-start gap-1.5 mt-2">
          {read && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2.5" className="mt-[3px] shrink-0">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
          <button
            onClick={navigateToArticle}
            className="block text-left w-full"
          >
            <h2 className="font-semibold leading-snug text-zinc-100">
              {item.title}
            </h2>
          </button>
        </div>

        {/* Snippet */}
        {item.contentSnippet && (
          <p className="mt-1.5 text-sm text-zinc-500 line-clamp-2">
            {item.contentSnippet}
          </p>
        )}

        {/* Date */}
        <p className="mt-2 text-xs text-zinc-600">
          {new Date(item.pubDate).toLocaleDateString()}
        </p>
      </div>

      {/* Actions row — auth-gated API actions */}
      <div className="flex items-center justify-around mt-3 pt-2 border-t border-zinc-800/60">
        {/* Upvote */}
        <button
          onClick={() => handleAction("upvote")}
          disabled={isLoading("upvote")}
          className={`flex items-center gap-1 py-1 px-3 rounded-lg transition-colors active:scale-95 ${
            isActive("upvote")
              ? "text-green-400"
              : "text-zinc-400 hover:bg-zinc-800/50"
          }`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={isActive("upvote") ? "#4ade80" : "none"}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 4l-8 8h5v8h6v-8h5z" />
          </svg>
          <span className="text-xs font-medium">{upCount}</span>
        </button>

        {/* Downvote */}
        <button
          onClick={() => handleAction("downvote")}
          disabled={isLoading("downvote")}
          className={`flex items-center gap-1 py-1 px-3 rounded-lg transition-colors active:scale-95 ${
            isActive("downvote")
              ? "text-red-400"
              : "text-zinc-400 hover:bg-zinc-800/50"
          }`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={isActive("downvote") ? "#f87171" : "none"}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 20l8-8h-5V4H9v8H4z" />
          </svg>
          <span className="text-xs font-medium">{downCount}</span>
        </button>

        {/* Save */}
        <button
          onClick={() => handleAction("save")}
          disabled={isLoading("save")}
          className={`flex items-center gap-1 py-1 px-3 rounded-lg transition-colors active:scale-95 ${
            isActive("save")
              ? "text-yellow-400"
              : "text-zinc-400 hover:bg-zinc-800/50"
          }`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={isActive("save") ? "#facc15" : "none"}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
          <span className="text-xs font-medium">
            {isActive("save") ? (showRemoveAction ? "Remove" : "Saved") : "Save"}
          </span>
        </button>

        {/* Dismiss */}
        <button
          onClick={() => handleAction("dismiss")}
          disabled={isLoading("dismiss")}
          className={`flex items-center gap-1 py-1 px-3 rounded-lg transition-colors active:scale-95 ${
            isActive("dismiss")
              ? "text-zinc-200"
              : "text-zinc-400 hover:bg-zinc-800/50"
          }`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={isActive("dismiss") ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <span className="text-xs font-medium">
            {isActive("dismiss") ? "Hidden" : "Hide"}
          </span>
        </button>

        {/* Share / Copy link */}
        <button
          onClick={() => navigator.clipboard.writeText(item.link)}
          className="flex items-center gap-1 py-1 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors active:scale-95 text-zinc-400"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
          </svg>
        </button>
      </div>
    </article>
  );
}
