"use client";

import { useState } from "react";

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  sourceTitle: string;
  sourceUrl: string;
  curatorNames: string[];
  curatorIds: string[];
  contentSnippet: string;
  image?: string;
}

interface ArticleCardProps {
  item: FeedItem;
  onRemoveSource: (sourceTitle: string) => void;
  hidden: boolean;
  vote: number;
}

export function ArticleCard({ item, onRemoveSource, hidden, vote }: ArticleCardProps) {
  const [confirming, setConfirming] = useState<"hide" | "remove" | null>(null);

  if (hidden) return null;

  const handleVote = (dir: 1 | -1) => {
    const votes = JSON.parse(localStorage.getItem("ic:votes") ?? "{}") as Record<string, number>;
    const current = votes[item.link] ?? 0;
    const next = current === dir ? 0 : dir;
    votes[item.link] = next;
    localStorage.setItem("ic:votes", JSON.stringify(votes));
    window.dispatchEvent(new Event("ic:votes-updated"));
  };

  const handleHide = () => {
    const hidden = JSON.parse(localStorage.getItem("ic:hidden") ?? "[]") as string[];
    if (!hidden.includes(item.link)) {
      hidden.push(item.link);
      localStorage.setItem("ic:hidden", JSON.stringify(hidden));
    }
    window.dispatchEvent(new Event("ic:hidden-updated"));
    setConfirming(null);
  };

  const handleRemoveSource = () => {
    onRemoveSource(item.sourceTitle);
    setConfirming(null);
  };

  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700 transition-colors">
      <div className="flex gap-4">
        {item.image && (
          <img src={item.image} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" loading="lazy" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-zinc-500">{item.sourceTitle}</span>
          </div>
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="block">
            <h2 className="font-medium leading-snug hover:text-zinc-300 transition-colors">{item.title}</h2>
          </a>
          {item.contentSnippet && (
            <p className="mt-2 text-sm text-zinc-500 line-clamp-2">{item.contentSnippet}</p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-zinc-600">
              via {item.curatorNames.join(", ")} · {new Date(item.pubDate).toLocaleDateString()}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => handleVote(1)} className={`rounded px-1.5 py-0.5 text-xs transition-colors ${vote === 1 ? "text-green-400" : "text-zinc-600 hover:text-zinc-400"}`}>▲</button>
              <button onClick={() => handleVote(-1)} className={`rounded px-1.5 py-0.5 text-xs transition-colors ${vote === -1 ? "text-red-400" : "text-zinc-600 hover:text-zinc-400"}`}>▼</button>
              <button onClick={() => setConfirming("hide")} className="rounded px-1.5 py-0.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Hide</button>
              <button onClick={() => setConfirming("remove")} className="rounded px-1.5 py-0.5 text-xs text-zinc-600 hover:text-red-400 transition-colors">Remove</button>
              <button onClick={() => navigator.clipboard.writeText(item.link)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Share</button>
            </div>
          </div>
        </div>
      </div>

      {confirming && (
        <div className="mt-3 rounded-md border border-zinc-700 bg-zinc-800 p-3">
          <p className="text-xs text-zinc-300 mb-2">
            {confirming === "hide" ? "Hide this article from your feed?" : `Stop seeing all articles from ${item.sourceTitle}?`}
          </p>
          <div className="flex gap-2">
            <button onClick={confirming === "hide" ? handleHide : handleRemoveSource} className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-500 transition-colors">
              Yes, {confirming === "hide" ? "hide it" : "remove"}
            </button>
            <button onClick={() => setConfirming(null)} className="rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600 transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </article>
  );
}
