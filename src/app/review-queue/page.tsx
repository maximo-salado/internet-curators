"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function ReviewQueuePage() {
  const router = useRouter();
  const [isEditor, setIsEditor] = useState<boolean | null>(null);
  const [sources, setSources] = useState<DiscoveredSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/discover/sources?status=pending&limit=50")
      .then((r) => r.json())
      .then((data) => {
        if (data.isEditor) {
          setIsEditor(true);
          setSources(data.items ?? []);
        } else {
          setIsEditor(false);
        }
      })
      .catch(() => setIsEditor(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 mb-16">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <div className="h-4 w-3/4 rounded bg-zinc-800 mb-3" />
              <div className="h-3 w-full rounded bg-zinc-800 mb-2" />
              <div className="h-3 w-1/2 rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (!isEditor) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-center mb-16">
        <p className="text-zinc-400">Access denied</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 mb-16">
      <h1 className="text-2xl font-semibold mb-6">Review Queue</h1>

      {sources.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-12 text-center">
          <p className="text-zinc-400">No pending sources to review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sources.map((source) => (
            <div key={source.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="font-medium text-zinc-200">{source.title}</h3>
              {source.description && (
                <p className="mt-1 text-sm text-zinc-500">{source.description}</p>
              )}
              <div className="mt-3 flex items-center gap-2 text-xs text-zinc-600">
                <span>{source.language}</span>
                <span>·</span>
                <span>{source.platform}</span>
              </div>
              {source.site_url && (
                <a
                  href={source.site_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-zinc-500 hover:text-zinc-300"
                >
                  {source.site_url.replace(/^https?:\/\//, "")} ↗
                </a>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={async () => {
                    await fetch(`/api/discover/sources/${source.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: "approved" }),
                    });
                    setSources((prev) => prev.filter((s) => s.id !== source.id));
                  }}
                  className="rounded-md bg-emerald-800 px-4 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-700 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={async () => {
                    await fetch(`/api/discover/sources/${source.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: "rejected" }),
                    });
                    setSources((prev) => prev.filter((s) => s.id !== source.id));
                  }}
                  className="rounded-md bg-red-900 px-4 py-1.5 text-xs font-medium text-red-300 hover:bg-red-800 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
