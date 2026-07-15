"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ArticleCard } from "@/components/ArticleCard";
import { CuratorStories } from "@/components/CuratorStories";

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  sourceTitle: string;
  sourceUrl: string;
  curatorNames: string[];
  curatorIds: string[];
  contentSnippet: string;
  content?: string;
  image?: string;
  upvotes?: number;
  downvotes?: number;
}

type Sort = "latest" | "popular";
type Tab = "feed" | "your";

function readLocalStorage() {
  return {
    followedIds: JSON.parse(localStorage.getItem("ic:followed") ?? "[]") as string[],
    votes: JSON.parse(localStorage.getItem("ic:votes") ?? "{}") as Record<string, number>,
    hiddenLinks: JSON.parse(localStorage.getItem("ic:hidden") ?? "[]") as string[],
    removedSources: JSON.parse(localStorage.getItem("ic:removedSources") ?? "[]") as string[],
  };
}

export default function FeedPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) || "feed";
  const [sort, setSort] = useState<Sort>("latest");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [local, setLocal] = useState(() => (typeof window !== "undefined" ? readLocalStorage() : { followedIds: [], votes: {}, hiddenLinks: [], removedSources: [] }));
  const [followedIds, setFollowedIds] = useState<string[]>(
    typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ic:followed") ?? "[]") : []
  );

  const syncLocal = useCallback(() => setLocal(readLocalStorage()), []);

  const onFollowedUpdated = useCallback(() => {
    syncLocal();
    setFollowedIds(JSON.parse(localStorage.getItem("ic:followed") ?? "[]"));
  }, [syncLocal]);

  useEffect(() => {
    syncLocal();
    window.addEventListener("ic:votes-updated", syncLocal);
    window.addEventListener("ic:hidden-updated", syncLocal);
    window.addEventListener("ic:removedSources-updated", syncLocal);
    window.addEventListener("ic:followed-updated", onFollowedUpdated);
    return () => {
      window.removeEventListener("ic:votes-updated", syncLocal);
      window.removeEventListener("ic:hidden-updated", syncLocal);
      window.removeEventListener("ic:removedSources-updated", syncLocal);
      window.removeEventListener("ic:followed-updated", onFollowedUpdated);
    };
  }, [syncLocal, onFollowedUpdated]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ sort });
    if (tab === "your") {
      params.set("feed", "your");
      params.set("followed", followedIds.join(","));
    } else {
      params.set("feed", "discover");
    }
    fetch(`/api/feed?${params}`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [tab, sort, followedIds]);

  const filteredItems = useMemo(() => {
    let result = items
      .filter((item) => !local.removedSources.includes(item.sourceTitle))
      .filter((item) => !local.hiddenLinks.includes(item.link));

    if (sort === "popular") {
      result = [...result].sort((a, b) => {
        const scoreA = local.votes[a.link] ?? 0;
        const scoreB = local.votes[b.link] ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        if (b.curatorNames.length !== a.curatorNames.length) return b.curatorNames.length - a.curatorNames.length;
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
      });
    }

    return result;
  }, [items, local, tab, sort]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-4">
      <CuratorStories />
      <div className="px-4 mt-4 mb-4 flex items-center justify-end">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const links = items.map((i) => i.link);
              const readLinks: string[] = JSON.parse(localStorage.getItem("ic:read") ?? "[]");
              const merged = [...new Set([...readLinks, ...links])].slice(-1000);
              localStorage.setItem("ic:read", JSON.stringify(merged));
              window.dispatchEvent(new Event("ic:read-updated"));
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Mark all read
          </button>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 outline-none">
            <option value="latest">Latest</option>
            <option value="popular">Popular</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <div className="h-4 w-3/4 rounded bg-zinc-800 mb-3" />
              <div className="h-3 w-full rounded bg-zinc-800 mb-2" />
              <div className="h-3 w-1/2 rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-12 text-center">
          <p className="text-zinc-400">No articles yet.</p>
          <p className="mt-2 text-sm text-zinc-600">Curators are building their collections. Check back soon.</p>
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {filteredItems.map((item, i) => (
            <ArticleCard
              key={`${item.link}-${i}`}
              item={item}
              onRemoveSource={(src) => {
                const next = [...local.removedSources, src];
                localStorage.setItem("ic:removedSources", JSON.stringify(next));
                window.dispatchEvent(new Event("ic:removedSources-updated"));
              }}
              hidden={false}
              vote={local.votes[item.link] ?? 0}
              showAddSource={tab !== "your"}
            />
          ))}
        </div>
      )}
    </main>
  );
}
