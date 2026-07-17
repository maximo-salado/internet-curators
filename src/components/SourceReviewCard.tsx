"use client";

import { useState } from "react";

interface DiscoveredSource {
  id: string;
  feed_url: string;
  site_url: string;
  title: string;
  description: string;
  platform: string;
  language: string;
  recent_posts: { title: string; link: string; date: string }[];
  suggested_tags: string[];
  independence_signals: {
    self_hosted?: boolean;
    custom_domain?: boolean;
    has_trackers?: boolean;
  };
  status: string;
  discovered_at: string;
}

interface Props {
  source: DiscoveredSource;
  isEditor: boolean;
  onTransition: (id: string, to: string) => void;
}

const platformColors: Record<string, string> = {
  substack: "bg-orange-900/50 text-orange-300",
  ghost: "bg-blue-900/50 text-blue-300",
  wordpress: "bg-sky-900/50 text-sky-300",
  bearblog: "bg-amber-900/50 text-amber-300",
  mastodon: "bg-purple-900/50 text-purple-300",
  lemmy: "bg-green-900/50 text-green-300",
  microblog: "bg-pink-900/50 text-pink-300",
  neocities: "bg-red-900/50 text-red-300",
  tumblr: "bg-indigo-900/50 text-indigo-300",
  medium: "bg-zinc-800 text-zinc-400",
  blogger: "bg-yellow-900/50 text-yellow-300",
};

export function SourceReviewCard({ source, isEditor, onTransition }: Props) {
  const [loading, setLoading] = useState(false);
  const sig = source.independence_signals;

  const handleAction = async (action: "approve" | "reject" | "pending") => {
    if (loading || !isEditor) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/discover/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) return;
      onTransition(source.id, action);
    } catch {
      // Network error — user can retry
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="rounded-xl bg-zinc-900 px-4 py-5">
      {/* Badge row */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {source.platform && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${platformColors[source.platform] ?? "bg-zinc-800 text-zinc-400"}`}>
            {source.platform}
          </span>
        )}
        {source.language && (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
            {source.language.toUpperCase()}
          </span>
        )}
        {sig?.self_hosted && (
          <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-[11px] font-medium text-green-300">
            self-hosted
          </span>
        )}
        {sig?.custom_domain && (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
            custom domain
          </span>
        )}
        {sig?.has_trackers && (
          <span className="rounded-full bg-yellow-900/50 px-2 py-0.5 text-[11px] font-medium text-yellow-300">
            trackers
          </span>
        )}
      </div>

      {/* Title */}
      <a
        href={source.site_url || source.feed_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <h2 className="font-semibold text-zinc-100 leading-snug hover:underline">
          {source.title}
        </h2>
      </a>

      {/* Description */}
      {source.description && (
        <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{source.description}</p>
      )}

      {/* Recent posts */}
      {source.recent_posts && source.recent_posts.length > 0 && (
        <div className="mt-2 border-t border-zinc-800 pt-2">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Recent posts</p>
          <ul className="space-y-0.5">
            {source.recent_posts.slice(0, 3).map((post, i) => (
              <li key={i} className="text-xs text-zinc-400 truncate">
                · {post.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested tags */}
      {source.suggested_tags && source.suggested_tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {source.suggested_tags.map((tag) => (
            <span key={tag} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions — context-aware per status */}
      {isEditor && (
        <div className="mt-3 flex gap-2 border-t border-zinc-800 pt-3">
          {source.status === "pending" && (
            <>
              <button onClick={() => handleAction("approve")} disabled={loading}
                className="flex-1 rounded-lg bg-green-900/30 border border-green-800 px-3 py-2 text-sm font-medium text-green-400 hover:bg-green-900/50 transition-colors disabled:opacity-50">
                ✓ Approve
              </button>
              <button onClick={() => handleAction("reject")} disabled={loading}
                className="flex-1 rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-900/50 transition-colors disabled:opacity-50">
                ✗ Reject
              </button>
            </>
          )}
          {source.status === "approved" && (
            <>
              <span className="text-xs font-medium text-green-400 self-center mr-auto">✓ Approved</span>
              <button onClick={() => handleAction("pending")} disabled={loading}
                className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-700 transition-colors disabled:opacity-50">
                ↩ Pending
              </button>
              <button onClick={() => handleAction("reject")} disabled={loading}
                className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-900/50 transition-colors disabled:opacity-50">
                ✗ Reject
              </button>
            </>
          )}
          {source.status === "rejected" && (
            <>
              <span className="text-xs font-medium text-red-400 self-center mr-auto">✗ Rejected</span>
              <button onClick={() => handleAction("pending")} disabled={loading}
                className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-700 transition-colors disabled:opacity-50">
                ↩ Pending
              </button>
              <button onClick={() => handleAction("approve")} disabled={loading}
                className="rounded-lg bg-green-900/30 border border-green-800 px-3 py-2 text-xs font-medium text-green-400 hover:bg-green-900/50 transition-colors disabled:opacity-50">
                ✓ Approve
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
