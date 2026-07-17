"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceId?: string;
  feedUrl?: string;
  curatorNames: string[];
  curatorIds: string[];
  contentSnippet: string;
  content?: string;
  image?: string;
  upvotes?: number;
  downvotes?: number;
}

interface ArticleCardProps {
  item: FeedItem;
  onRemoveSource: (sourceTitle: string) => void;
  hidden: boolean;
  vote: number;
  showAddSource?: boolean;
  compact?: boolean;
}

export function ArticleCard({ item, onRemoveSource, hidden, vote, showAddSource, compact }: ArticleCardProps) {
  const [confirming, setConfirming] = useState<"hide" | "remove" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [upCount, setUpCount] = useState(item.upvotes ?? 0);
  const [downCount, setDownCount] = useState(item.downvotes ?? 0);
  const [read, setRead] = useState(false);

  const handleAddSource = async () => {
    if (adding || added || !item.feedUrl) return;
    setAdding(true);
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedUrl: item.feedUrl,
          sourceTitle: item.sourceTitle,
          sourceUrl: item.sourceUrl,
        }),
      });
      const data = await res.json();
      if (data.added) {
        setAdded(true);
        window.dispatchEvent(new CustomEvent("ic:source-added", { detail: item.sourceTitle }));
      }
    } catch {} finally {
      setAdding(false);
    }
  };

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

  if (hidden) return null;

  if (compact) {
    return (
      <article className="rounded-lg bg-zinc-900 px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <button
              onClick={() => {
                markRead();
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
              }}
              className="block text-left w-full"
            >
              <h3 className="text-sm font-medium text-zinc-100 leading-snug truncate">{item.title}</h3>
            </button>
            <p className="mt-0.5 text-xs text-zinc-500 truncate">
              {item.sourceTitle}
              {item.curatorNames.length > 0 && ` · via ${item.curatorNames[0]}`}
            </p>
          </div>
        </div>
      </article>
    );
  }
  const handleVote = (dir: 1 | -1) => {
    const votes = JSON.parse(localStorage.getItem("ic:votes") ?? "{}") as Record<string, number>;
    const prev = votes[item.link] ?? 0;
    const next = prev === dir ? 0 : dir;
    votes[item.link] = next;
    localStorage.setItem("ic:votes", JSON.stringify(votes));
    window.dispatchEvent(new Event("ic:votes-updated"));

    // Optimistic: undo old vote, apply new vote
    if (prev === 1) setUpCount((c) => c - 1);
    if (prev === -1) setDownCount((c) => c - 1);
    if (next === 1) setUpCount((c) => c + 1);
    if (next === -1) setDownCount((c) => c + 1);

    fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link: item.link, prev, next }),
    }).catch(() => {});
  };

  const handleHide = () => {
    const hidden = JSON.parse(localStorage.getItem("ic:hidden") ?? "[]") as string[];
    if (!hidden.includes(item.link)) hidden.push(item.link);
    localStorage.setItem("ic:hidden", JSON.stringify(hidden));
    window.dispatchEvent(new Event("ic:hidden-updated"));
    setConfirming(null);
  };

  const handleRemoveSource = () => {
    onRemoveSource(item.sourceTitle);
    setConfirming(null);
  };

  const curatorElements = item.curatorNames.length > 0
    ? item.curatorNames.map((name, i) => ({ name, id: item.curatorIds[i] }))
    : null;

  const hasImage = !compact && !!item.image;

  return (
    <article ref={cardRef} className={`rounded-xl overflow-hidden relative ${hasImage ? "h-80" : "bg-zinc-900 px-4 py-5"}`}>
      {read && (
        <div className="absolute top-3 right-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800/80">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
      )}
      {hasImage && (
        <>
          <img
            src={item.image!}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />
        </>
      )}

      <div className={`relative flex flex-col ${hasImage ? "h-full justify-between p-4" : ""}`}>
        {/* Source badge — top */}
        <div>
          {item.sourceId ? (
            <Link
              href={`/source/${item.sourceId}`}
              onClick={(e) => e.stopPropagation()}
              className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium hover:underline ${hasImage ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-400"}`}
            >
              {item.sourceTitle}
            </Link>
          ) : (
            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${hasImage ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-400"}`}>
              {item.sourceTitle}
            </span>
          )}
        </div>

        {/* Title + snippet — middle */}
        <div className={hasImage ? "mt-auto" : "mt-3"}>
          <button
            onClick={() => {
              markRead();
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
            }}
            className="block text-left w-full"
          >
            <h2 className={`font-semibold leading-snug ${hasImage ? "text-white text-lg" : "text-zinc-100"}`}>
              {item.title}
            </h2>
          </button>
          {item.contentSnippet && (
            <p className={`mt-1.5 text-sm line-clamp-2 ${hasImage ? "text-white/70" : "text-zinc-500"}`}>
              {item.contentSnippet}
            </p>
          )}
        </div>

        {/* Curator + actions — bottom */}
        <div className={`flex items-center justify-between ${hasImage ? "" : "mt-3"}`}>
          <p className={`text-xs ${hasImage ? "text-white/50" : "text-zinc-600"}`}>
            {curatorElements ? (
              <>
                via{" "}
                {curatorElements.map((c, i) => (
                  <span key={c.id}>
                    <Link
                      href={`/curator/${c.id}`}
                      className={`underline-offset-2 hover:underline ${hasImage ? "text-white/70" : "text-zinc-400"}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.name}
                    </Link>
                    {i < curatorElements.length - 1 && ", "}
                  </span>
                ))}
              </>
            ) : (
              "Trending"
            )}{" "}
            · {new Date(item.pubDate).toLocaleDateString()}
          </p>
        {/* Actions strip */}
        <div className={`flex items-center justify-around border-t border-zinc-800 pt-3 ${hasImage ? "relative z-10" : ""}`}>
          {showAddSource && (
            <button
              onClick={handleAddSource}
              disabled={adding || added}
              className={`flex items-center gap-1 py-1 px-3 rounded-lg transition-colors active:scale-95 ${
                added ? "text-green-400" : "text-zinc-400 hover:bg-zinc-800/50"
              }`}
            >
              {added ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              )}
              <span className="text-xs font-medium">{added ? "Added" : "Save"}</span>
            </button>
          )}
          <button onClick={() => handleVote(1)} className={`flex items-center gap-1 py-1 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors active:scale-95 ${vote === 1 ? "text-green-400" : "text-zinc-400"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={vote === 1 ? "#4ade80" : "none"} stroke="currentColor" strokeWidth="2"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>
            <span className="text-xs font-medium">{upCount}</span>
          </button>
          <button onClick={() => handleVote(-1)} className={`flex items-center gap-1 py-1 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors active:scale-95 ${vote === -1 ? "text-red-400" : "text-zinc-400"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={vote === -1 ? "#f87171" : "none"} stroke="currentColor" strokeWidth="2"><path d="M12 20l8-8h-5V4H9v8H4z"/></svg>
            <span className="text-xs font-medium">{downCount}</span>
          </button>
          <button onClick={() => navigator.clipboard.writeText(item.link)} className="flex items-center gap-1 py-1 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors active:scale-95 text-zinc-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
          </button>
          <div ref={menuRef} className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-1 py-1 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors active:scale-95 text-zinc-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
            {menuOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-36 rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl z-50">
                <button onClick={() => { setConfirming("hide"); setMenuOpen(false); }} className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-700 rounded-t-lg transition-colors">Hide</button>
                <button onClick={() => { setConfirming("remove"); setMenuOpen(false); }} className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-zinc-700 rounded-b-lg transition-colors">Remove source</button>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {confirming && (
        <div className="absolute inset-x-0 bottom-0 z-10 border-t border-zinc-700 bg-zinc-900 p-3">
          <p className="text-xs text-zinc-300 mb-2">
            {confirming === "hide" ? "Hide this article?" : `Stop seeing ${item.sourceTitle}?`}
          </p>
          <div className="flex gap-2">
            <button onClick={confirming === "hide" ? handleHide : handleRemoveSource} className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-500">
              Yes, {confirming === "hide" ? "hide" : "remove"}
            </button>
            <button onClick={() => setConfirming(null)} className="rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600">
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
