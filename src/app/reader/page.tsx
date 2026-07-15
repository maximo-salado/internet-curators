"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<link[\s\S]*?>/gi, "")
    .replace(/<meta[\s\S]*?>/gi, "")
    .replace(/\s(on\w+)=/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/<video[\s\S]*?<\/video>/gi, "")
    .replace(/<audio[\s\S]*?<\/audio>/gi, "")
    .replace(/javascript:/gi, "");
}

export default function ReaderPage() {
  const searchParams = useSearchParams();
  const title = searchParams.get("title") || "Untitled";
  const source = searchParams.get("source") || "";
  const date = searchParams.get("date") || "";
  const link = searchParams.get("link") || "";
  const image = searchParams.get("image") || "";
  const content = searchParams.get("content") || searchParams.get("snippet") || "";
  const upvotes = parseInt(searchParams.get("upvotes") || "0");
  const downvotes = parseInt(searchParams.get("downvotes") || "0");

  const [upCount, setUpCount] = useState(upvotes);
  const [downCount, setDownCount] = useState(downvotes);
  const [confirming, setConfirming] = useState<"hide" | "remove" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const cleanHtml = sanitize(content);

  const localVote = typeof window !== "undefined"
    ? (JSON.parse(localStorage.getItem("ic:votes") ?? "{}") as Record<string, number>)[link] ?? 0
    : 0;

  const handleVote = (dir: 1 | -1) => {
    const votes = JSON.parse(localStorage.getItem("ic:votes") ?? "{}") as Record<string, number>;
    const prev = votes[link] ?? 0;
    const next = prev === dir ? 0 : dir;
    votes[link] = next;
    localStorage.setItem("ic:votes", JSON.stringify(votes));
    window.dispatchEvent(new Event("ic:votes-updated"));

    if (prev === 1) setUpCount((c) => c - 1);
    if (prev === -1) setDownCount((c) => c - 1);
    if (next === 1) setUpCount((c) => c + 1);
    if (next === -1) setDownCount((c) => c + 1);

    fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link, prev, next }),
    }).catch(() => {});
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            {source && <p className="text-xs text-zinc-500 mb-2">{source}</p>}
            <h1 className="text-xl font-semibold leading-snug">{title}</h1>
            {date && <p className="mt-2 text-xs text-zinc-600">{new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>}
          </div>
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800/80 mt-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
        </div>
      </div>

      {/* Image */}
      {image && (
        <img src={image} alt="" className="w-full rounded-lg mb-6" />
      )}

      {/* Content */}
      {cleanHtml ? (
        <div
          className="prose prose-invert prose-zinc max-w-none text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      ) : (
        <p className="text-zinc-500 text-sm">No preview available.</p>
      )}

      {/* Actions strip */}
      <div className="mt-10 pt-4 border-t border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => handleVote(1)} className={`flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-zinc-800/50 transition-colors active:scale-95 ${localVote === 1 ? "text-green-400" : "text-zinc-400"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={localVote === 1 ? "#4ade80" : "none"} stroke="currentColor" strokeWidth="2"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>
            <span className="text-xs font-medium">{upCount}</span>
          </button>
          <button onClick={() => handleVote(-1)} className={`flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-zinc-800/50 transition-colors active:scale-95 ${localVote === -1 ? "text-red-400" : "text-zinc-400"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={localVote === -1 ? "#f87171" : "none"} stroke="currentColor" strokeWidth="2"><path d="M12 20l8-8h-5V4H9v8H4z"/></svg>
            <span className="text-xs font-medium">{downCount}</span>
          </button>
          <button onClick={() => navigator.clipboard.writeText(link)} className="flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-zinc-800/50 transition-colors active:scale-95 text-zinc-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-zinc-800/50 transition-colors active:scale-95 text-zinc-400">
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
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 transition-colors"
        >
          Open original →
        </a>
      </div>

      {confirming && (
        <div className="mt-3 rounded-md border border-zinc-700 bg-zinc-800 p-3">
          <p className="text-xs text-zinc-300 mb-2">
            {confirming === "hide" ? "Hide this article?" : `Stop seeing ${source}?`}
          </p>
          <div className="flex gap-2">
            <button onClick={() => {
              if (confirming === "hide") {
                const hidden = JSON.parse(localStorage.getItem("ic:hidden") ?? "[]") as string[];
                if (!hidden.includes(link)) hidden.push(link);
                localStorage.setItem("ic:hidden", JSON.stringify(hidden));
                window.dispatchEvent(new Event("ic:hidden-updated"));
              } else {
                const removed = JSON.parse(localStorage.getItem("ic:removedSources") ?? "[]") as string[];
                if (!removed.includes(source)) removed.push(source);
                localStorage.setItem("ic:removedSources", JSON.stringify(removed));
                window.dispatchEvent(new Event("ic:removedSources-updated"));
              }
              setConfirming(null);
              window.history.back();
            }} className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-500">
              Yes, {confirming === "hide" ? "hide" : "remove"}
            </button>
            <button onClick={() => setConfirming(null)} className="rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600">Cancel</button>
          </div>
        </div>
      )}
    </main>
  );
}
