"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { CuratorStories } from "@/components/CuratorStories";
import { getSeenSources, saveSeenSources, boostUnseen } from "@/lib/feed-rotation";
import { getFreshPicks } from "@/lib/fresh-picks";

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceId?: string;
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

const PAGE_SIZE = 20;

function readLocalStorage() {
  return {
    followedIds: JSON.parse(localStorage.getItem("ic:followed") ?? "[]") as string[],
    votes: JSON.parse(localStorage.getItem("ic:votes") ?? "{}") as Record<string, number>,
    hiddenLinks: JSON.parse(localStorage.getItem("ic:hidden") ?? "[]") as string[],
    removedSources: JSON.parse(localStorage.getItem("ic:removedSources") ?? "[]") as string[],
  };
}

export default function FeedPage() {
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) || "feed";
  const [sort, setSort] = useState<Sort>("latest");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [freshPicks, setFreshPicks] = useState<FeedItem[]>([]);
  const [local, setLocal] = useState(() => (typeof window !== "undefined" ? readLocalStorage() : { followedIds: [], votes: {}, hiddenLinks: [], removedSources: [] }));
  const [followedIds, setFollowedIds] = useState<string[]>(
    typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ic:followed") ?? "[]") : []
  );
  const [nudgeData, setNudgeData] = useState<{ currentTopic: string; suggestedTopic: string; suggestedSourceId: string } | null>(null);
  const nudgeShownRef = useRef(typeof window !== "undefined" && sessionStorage.getItem("ic:nudge-shown") === "1");
  const [digestMode, setDigestMode] = useState(false);
  const [showDigestBanner, setShowDigestBanner] = useState(false);

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
    const today = new Date().toISOString().slice(0, 10);
    const lastVisit = localStorage.getItem("ic:last-visit-date");
    if (lastVisit && lastVisit !== today && followedIds.length > 0) {
      setShowDigestBanner(true);
    }
    localStorage.setItem("ic:last-visit-date", today);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setTotal(0);

    const params = new URLSearchParams({ sort, offset: "0", limit: String(PAGE_SIZE) });
    if (tab === "your") {
      params.set("feed", "your");
      params.set("followed", followedIds.join(","));
    } else {
      params.set("feed", "discover");
    }
    fetch(`/api/feed?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const pageItems: FeedItem[] = data.items ?? [];
        const seen = getSeenSources();
        const boosted = boostUnseen(pageItems, seen);
        setItems(boosted);
        setFreshPicks(getFreshPicks(pageItems, seen));
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setOffset(PAGE_SIZE);
      })
      .finally(() => setLoading(false));
  }, [tab, sort, followedIds]);

  // Save seen sources on unmount or tab switch
  useEffect(() => {
    return () => {
      const sourceTitles = items.map((i) => i.sourceTitle);
      if (sourceTitles.length > 0) saveSeenSources(sourceTitles);
    };
  }, [items]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && items.length > 0) {
        saveSeenSources(items.map((i) => i.sourceTitle));
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [items]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    const params = new URLSearchParams({ sort, offset: String(offset), limit: String(PAGE_SIZE) });
    if (tab === "your") {
      params.set("feed", "your");
      params.set("followed", followedIds.join(","));
    } else {
      params.set("feed", "discover");
    }
    fetch(`/api/feed?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const pageItems: FeedItem[] = data.items ?? [];
        const seen = getSeenSources();
        const boosted = boostUnseen(pageItems, seen);
        setItems((prev) => [...prev, ...boosted]);
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setOffset((prev) => prev + PAGE_SIZE);

        if (!nudgeShownRef.current) {
          const allItems = [...items, ...boosted];
          const freq = new Map<string, { count: number; sourceId?: string }>();
          for (const item of allItems) {
            const key = item.sourceTitle;
            const entry = freq.get(key);
            if (entry) entry.count++;
            else freq.set(key, { count: 1, sourceId: item.sourceId });
          }
          if (freq.size >= 2) {
            const sorted = [...freq.entries()].sort((a, b) => b[1].count - a[1].count);
            const dominant = sorted[0];
            const alternative = sorted[Math.floor(sorted.length / 2)];
            if (dominant[0] !== alternative[0] && alternative[1].sourceId) {
              setNudgeData({
                currentTopic: dominant[0],
                suggestedTopic: alternative[0],
                suggestedSourceId: alternative[1].sourceId,
              });
              nudgeShownRef.current = true;
              sessionStorage.setItem("ic:nudge-shown", "1");
            }
          }
        }
      })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, offset, sort, tab, followedIds]);

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

  const digestItems = useMemo(() => {
    const seenCurators = new Set<string>();
    const result: FeedItem[] = [];
    for (const item of filteredItems) {
      for (const id of item.curatorIds) {
        if (!seenCurators.has(id)) {
          seenCurators.add(id);
          result.push(item);
          break;
        }
      }
      if (seenCurators.size >= followedIds.length) break;
    }
    return result;
  }, [filteredItems, followedIds]);

  const displayItems = digestMode ? digestItems : filteredItems;

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
          {showDigestBanner && tab === "your" && (
            <button
              onClick={() => { setDigestMode((d) => !d); setShowDigestBanner(false); }}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              {digestMode ? "Full Feed" : "Daily Digest"}
            </button>
          )}
        </div>
      </div>

      {showDigestBanner && tab === "your" && !digestMode && followedIds.length > 0 && (
        <div className="mx-4 mb-4 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-zinc-400">Welcome back! Try the Daily Digest for a quick recap from your curators.</p>
          <button
            onClick={() => { setDigestMode(true); setShowDigestBanner(false); }}
            className="ml-3 whitespace-nowrap rounded-md bg-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-600 transition-colors"
          >
            View Digest
          </button>
        </div>
      )}

      {freshPicks.length > 0 && !loading && !digestMode && (
        <div className="mx-4 mb-6 rounded-lg border border-zinc-800 bg-zinc-800/50 p-4">
          <h2 className="mb-3 text-xs font-medium text-zinc-500">Fresh since your last visit</h2>
          <div className="space-y-2">
            {freshPicks.map((item, i) => (
              <ArticleCard
                key={`fresh-${item.link}-${i}`}
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
        </div>
      )}

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
      ) : displayItems.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-12 text-center">
          <p className="text-zinc-400">No articles yet.</p>
          <p className="mt-2 text-sm text-zinc-600">Curators are building their collections. Check back soon.</p>
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {displayItems.map((item, i) => (
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
              compact={digestMode}
            />
          ))}

          {nudgeData && !digestMode && (
            <div className="border-t border-zinc-800 py-4 text-center">
              <p className="text-xs text-zinc-500">
                You have been reading a lot of {nudgeData.currentTopic}.{" "}
                <Link
                  href={`/source/${nudgeData.suggestedSourceId}`}
                  className="text-zinc-400 underline underline-offset-2 hover:text-zinc-300 transition-colors"
                >
                  Try {nudgeData.suggestedTopic}?
                </Link>
              </p>
            </div>
          )}

          <div className="py-6 text-center">
            <p className="text-xs text-zinc-600 mb-3">
              Showing {displayItems.length} of {total} articles
            </p>
            {hasMore ? (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-300 disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            ) : (
              <p className="text-sm text-zinc-500">You are all caught up!</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
