"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { CuratorCard } from "@/components/CuratorCard";
import { ArticleCard } from "@/components/ArticleCard";

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

interface Curator {
  id: string;
  display_name: string;
  bio: string;
  follower_counts: { count: number } | null;
}

type Sort = "latest" | "popular";
type Tab = "feed" | "your" | "curators";

function readLocalStorage() {
  return {
    followedIds: JSON.parse(localStorage.getItem("ic:followed") ?? "[]") as string[],
    votes: JSON.parse(localStorage.getItem("ic:votes") ?? "{}") as Record<string, number>,
    hiddenLinks: JSON.parse(localStorage.getItem("ic:hidden") ?? "[]") as string[],
    removedSources: JSON.parse(localStorage.getItem("ic:removedSources") ?? "[]") as string[],
  };
}

export default function Home() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("feed");
  const [sort, setSort] = useState<Sort>("latest");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [curators, setCurators] = useState<Curator[]>([]);
  const [loading, setLoading] = useState(true);
  const [local, setLocal] = useState(() => (typeof window !== "undefined" ? readLocalStorage() : { followedIds: [], votes: {}, hiddenLinks: [], removedSources: [] }));

  const syncLocal = useCallback(() => setLocal(readLocalStorage()), []);

  useEffect(() => {
    syncLocal();
    window.addEventListener("ic:votes-updated", syncLocal);
    window.addEventListener("ic:hidden-updated", syncLocal);
    window.addEventListener("ic:removedSources-updated", syncLocal);
    window.addEventListener("ic:followed-updated", syncLocal);
    return () => {
      window.removeEventListener("ic:votes-updated", syncLocal);
      window.removeEventListener("ic:hidden-updated", syncLocal);
      window.removeEventListener("ic:removedSources-updated", syncLocal);
      window.removeEventListener("ic:followed-updated", syncLocal);
    };
  }, [syncLocal]);

  useEffect(() => {
    setLoading(true);
    if (tab === "curators") {
      fetch("/api/curators")
        .then((r) => r.json())
        .then((data) => setCurators(Array.isArray(data) ? data : []))
        .finally(() => setLoading(false));
    } else {
      const params = new URLSearchParams({ sort });
      if (tab === "your") {
        params.set("feed", "your");
        params.set("followed", local.followedIds.join(","));
      }
      fetch(`/api/feed?${params}`)
        .then((r) => r.json())
        .then((data) => setItems(Array.isArray(data) ? data : []))
        .finally(() => setLoading(false));
    }
  }, [tab, sort, local.followedIds]);

  const filteredItems = useMemo(() => {
    let result = items
      .filter((item) => !local.removedSources.includes(item.sourceTitle))
      .filter((item) => !local.hiddenLinks.includes(item.link));

    if (sort === "popular") {
      // Sort by vote score (up=+1, down=-1), then by curator count, then date
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
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-6">
          <button onClick={() => setTab("feed")} className={`text-sm font-medium pb-1 border-b-2 transition-colors ${tab === "feed" ? "text-zinc-100 border-zinc-100" : "text-zinc-500 border-transparent hover:text-zinc-300"}`}>Feed</button>
          {user && (
            <button onClick={() => setTab("your")} className={`text-sm font-medium pb-1 border-b-2 transition-colors ${tab === "your" ? "text-zinc-100 border-zinc-100" : "text-zinc-500 border-transparent hover:text-zinc-300"}`}>Your Feed</button>
          )}
          <button onClick={() => setTab("curators")} className={`text-sm font-medium pb-1 border-b-2 transition-colors ${tab === "curators" ? "text-zinc-100 border-zinc-100" : "text-zinc-500 border-transparent hover:text-zinc-300"}`}>Popular Curators</button>
        </div>
        {tab !== "curators" && (
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 outline-none">
            <option value="latest">Latest</option>
            <option value="popular">Popular</option>
          </select>
        )}
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
      ) : tab === "curators" ? (
        curators.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-12 text-center">
            <p className="text-zinc-400">No curators yet.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {curators.map((c) => (
              <CuratorCard key={c.id} curator={c} isLoggedIn={!!user} />
            ))}
          </div>
        )
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-12 text-center">
          <p className="text-zinc-400">No articles yet.</p>
          <p className="mt-2 text-sm text-zinc-600">Curators are building their collections. Check back soon.</p>
        </div>
      ) : (
        <div className="space-y-3">
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
            />
          ))}
        </div>
      )}
    </main>
  );
}
