"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { SourceReviewCard } from "@/components/SourceReviewCard";
import { CuratorStories } from "@/components/CuratorStories";
import { ReadingStats } from "@/components/ReadingStats";
import { getSeenSources, saveSeenSources, boostUnseen } from "@/lib/feed-rotation";

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

type Sort = "latest" | "popular";
type Tab = "feed" | "your";
type DiscoverMode = "articles" | "sources";
type SourceFilter = "pending" | "approved" | "rejected";

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
  const [local, setLocal] = useState(() => (typeof window !== "undefined" ? readLocalStorage() : { followedIds: [], votes: {}, hiddenLinks: [], removedSources: [] }));
  const [discoverSeed] = useState(() => {
    if (typeof window === "undefined") return "";
    const stored = sessionStorage.getItem("ic:discover-seed");
    if (stored) return stored;
    const seed = String(Math.floor(Math.random() * 1000000));
    sessionStorage.setItem("ic:discover-seed", seed);
    return seed;
  });
  const [followedIds, setFollowedIds] = useState<string[]>(
    typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ic:followed") ?? "[]") : []
  );
  const [nudgeData, setNudgeData] = useState<{ currentTopic: string; suggestedTopic: string; suggestedSourceId: string } | null>(null);
  const nudgeShownRef = useRef(typeof window !== "undefined" && sessionStorage.getItem("ic:nudge-shown") === "1");
  const [digestMode, setDigestMode] = useState(false);
  const [showDigestBanner, setShowDigestBanner] = useState(false);

  // --- Discovery Sources mode ---
  const [discoverMode, setDiscoverMode] = useState<DiscoverMode>("articles");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("pending");
  const [isEditor, setIsEditor] = useState(false);
  const [sources, setSources] = useState<DiscoveredSource[]>([]);
  const [sourcesTotal, setSourcesTotal] = useState(0);
  const [sourcesOffset, setSourcesOffset] = useState(0);
  const [sourcesHasMore, setSourcesHasMore] = useState(true);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  const syncLocal = useCallback(() => setLocal(readLocalStorage()), []);

  const onFollowedUpdated = useCallback(() => {
    syncLocal();
    setFollowedIds(JSON.parse(localStorage.getItem("ic:followed") ?? "[]"));
  }, [syncLocal]);

  // Check editor status once on mount
  useEffect(() => {
    fetch("/api/discover/sources?status=pending&limit=1")
      .then((r) => r.json())
      .then((data) => { if (data.isEditor) setIsEditor(true); })
      .catch(() => {});
  }, []);

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

  // --- Article feed (existing logic, unchanged) ---
  useEffect(() => {
    if (discoverMode !== "articles") return;
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
      if (discoverSeed) params.set("seed", discoverSeed);
    }
    fetch(`/api/feed?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const pageItems: FeedItem[] = data.items ?? [];
        if (tab === "your") {
          const seen = getSeenSources();
          setItems(boostUnseen(pageItems, seen));
        } else {
          setItems(pageItems);
        }
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setOffset(PAGE_SIZE);
      })
      .finally(() => setLoading(false));
  }, [tab, sort, followedIds, discoverSeed, discoverMode]);

  // --- Sources fetch ---
  const fetchSources = useCallback((status: SourceFilter, off: number, append: boolean) => {
    setSourcesLoading(true);
    const params = new URLSearchParams({ status, offset: String(off), limit: String(PAGE_SIZE) });
    fetch(`/api/discover/sources?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const pageItems: DiscoveredSource[] = data.items ?? [];
        if (append) {
          setSources((prev) => [...prev, ...pageItems]);
        } else {
          setSources(pageItems);
        }
        setSourcesTotal(data.total ?? 0);
        setSourcesHasMore(data.hasMore ?? false);
        setSourcesOffset(off + PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setSourcesLoading(false));
  }, []);

  // Fetch sources when mode or filter changes
  useEffect(() => {
    if (discoverMode === "sources") {
      setSources([]);
      setSourcesOffset(0);
      setSourcesHasMore(true);
      setSourcesTotal(0);
      fetchSources(sourceFilter, 0, false);
    }
  }, [discoverMode, sourceFilter, fetchSources]);

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

    // Sources mode: load more sources
    if (discoverMode === "sources") {
      if (sourcesLoading || !sourcesHasMore) return;
      fetchSources(sourceFilter, sourcesOffset, true);
      return;
    }

    // Articles mode: existing logic
    setLoadingMore(true);
    const params = new URLSearchParams({ sort, offset: String(offset), limit: String(PAGE_SIZE) });
    if (tab === "your") {
      params.set("feed", "your");
      params.set("followed", followedIds.join(","));
    } else {
      params.set("feed", "discover");
      if (discoverSeed) params.set("seed", discoverSeed);
    }
    fetch(`/api/feed?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const pageItems: FeedItem[] = data.items ?? [];
        let newItems: FeedItem[];
        if (tab === "your") {
          const seen = getSeenSources();
          newItems = boostUnseen(pageItems, seen);
        } else {
          newItems = pageItems;
        }
        setItems((prev) => [...prev, ...newItems]);
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setOffset((prev) => prev + PAGE_SIZE);

        if (!nudgeShownRef.current) {
          const allItems = [...items, ...newItems];
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
  }, [loadingMore, hasMore, offset, sort, tab, followedIds, discoverSeed, discoverMode, sourcesLoading, sourcesHasMore, sourcesOffset, sourceFilter, fetchSources]);

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

  const displayItems = useMemo(() => {
    return digestMode ? digestItems : filteredItems;
  }, [digestMode, digestItems, filteredItems]);

  const onTransition = useCallback((id: string, to: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-4">
      <CuratorStories />

      {/* Mode toggle — editor only, Discover tab only */}
      {isEditor && tab === "feed" && (
        <div className="px-4 mt-4 mb-4">
          <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-0.5">
            <button
              onClick={() => setDiscoverMode("articles")}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                discoverMode === "articles" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Articles
            </button>
            <button
              onClick={() => setDiscoverMode("sources")}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                discoverMode === "sources" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Sources
            </button>
          </div>

          {/* Sub-filter for Sources mode */}
          {discoverMode === "sources" && (
            <div className="flex items-center gap-2 mt-2">
              {(["pending", "approved", "rejected"] as SourceFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setSourceFilter(f)}
                  className={`rounded-full px-3 py-0.5 text-[11px] font-medium transition-colors ${
                    sourceFilter === f
                      ? "bg-zinc-800 text-zinc-200"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- Sources mode --- */}
      {discoverMode === "sources" && tab === "feed" && isEditor ? (
        <div className="px-4 space-y-2">
          {sourcesLoading && sources.length === 0 ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                  <div className="h-4 w-3/4 rounded bg-zinc-800 mb-3" />
                  <div className="h-3 w-full rounded bg-zinc-800 mb-2" />
                  <div className="h-3 w-1/2 rounded bg-zinc-800" />
                </div>
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-12 text-center">
              <p className="text-zinc-400">No {sourceFilter} sources.</p>
              <p className="mt-2 text-sm text-zinc-600">
                {sourceFilter === "pending" ? "The discovery pipeline hasn't found any candidates yet." : "Nothing here yet."}
              </p>
            </div>
          ) : (
            <>
              {sources.map((source) => (
                <SourceReviewCard
                  key={source.id}
                  source={source}
                  isEditor={isEditor}
                  onTransition={onTransition}
                />
              ))}

              <div className="py-6 text-center">
                <p className="text-xs text-zinc-600 mb-3">
                  Showing {sources.length} of {sourcesTotal} sources
                </p>
                {sourcesHasMore ? (
                  <button
                    onClick={loadMore}
                    disabled={sourcesLoading}
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-300 disabled:opacity-50"
                  >
                    {sourcesLoading ? "Loading..." : "Load More"}
                  </button>
                ) : (
                  <p className="text-sm text-zinc-500">All sources reviewed.</p>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        /* --- Articles mode (existing behavior, unchanged) --- */
        <>
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
                ) : tab === "feed" ? (
                  <p className="text-sm text-zinc-500">You have seen everything — check back later or explore collections.</p>
                ) : (
                  <p className="text-sm text-zinc-500">You are all caught up!</p>
                )}
              </div>
              <ReadingStats loadedCount={items.length} />
            </div>
          )}
        </>
      )}
    </main>
  );
}
