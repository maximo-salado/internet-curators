"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { WelcomeBanner } from "@/components/WelcomeBanner";
import { CuratorStrip } from "@/components/CuratorStrip";
import { FiltersBar } from "@/components/FiltersBar";
import { FollowButton } from "@/components/FollowButton";
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

interface Curator {
  id: string;
  display_name: string;
  bio: string;
  follower_counts: { count: number } | null;
}

interface FollowData {
  curators: { id: string; curator_id: string }[];
  sources: { id: string; source_id: string }[];
}

const PAGE_SIZE = 20;

export default function HomePage() {
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as string) || "discover";
  const tagSlugs = searchParams.get("tags")?.split(",").filter(Boolean) ?? [];

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discoverSeed] = useState(() => {
    if (typeof window === "undefined") return "";
    const stored = sessionStorage.getItem("ic:discover-seed");
    if (stored) return stored;
    const seed = String(Math.floor(Math.random() * 1000000));
    sessionStorage.setItem("ic:discover-seed", seed);
    return seed;
  });

  // My Feed auth state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [follows, setFollows] = useState<FollowData | null>(null);
  const [suggestedCurators, setSuggestedCurators] = useState<Curator[]>([]);

  // Local storage state
  const [local, setLocal] = useState(() => {
    if (typeof window === "undefined") return { votes: {}, hiddenLinks: [], removedSources: [] };
    return {
      votes: JSON.parse(localStorage.getItem("ic:votes") ?? "{}") as Record<string, number>,
      hiddenLinks: JSON.parse(localStorage.getItem("ic:hidden") ?? "[]") as string[],
      removedSources: JSON.parse(localStorage.getItem("ic:removedSources") ?? "[]") as string[],
    };
  });

  const syncLocal = useCallback(() => {
    if (typeof window === "undefined") return;
    setLocal({
      votes: JSON.parse(localStorage.getItem("ic:votes") ?? "{}"),
      hiddenLinks: JSON.parse(localStorage.getItem("ic:hidden") ?? "[]"),
      removedSources: JSON.parse(localStorage.getItem("ic:removedSources") ?? "[]"),
    });
  }, []);

  useEffect(() => {
    syncLocal();
    window.addEventListener("ic:votes-updated", syncLocal);
    window.addEventListener("ic:hidden-updated", syncLocal);
    window.addEventListener("ic:removedSources-updated", syncLocal);
    return () => {
      window.removeEventListener("ic:votes-updated", syncLocal);
      window.removeEventListener("ic:hidden-updated", syncLocal);
      window.removeEventListener("ic:removedSources-updated", syncLocal);
    };
  }, [syncLocal]);

  // Check auth state on mount
  useEffect(() => {
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        setIsLoggedIn(!!data.user);
      });
    });
  }, []);

  // Load follows for My Feed
  useEffect(() => {
    if (tab !== "my-feed") return;
    fetch("/api/follows")
      .then((r) => r.json())
      .then((data) => {
        setFollows(data);
        setIsLoggedIn(true);
      })
      .catch(() => {
        setFollows({ curators: [], sources: [] });
      });
  }, [tab]);

  // Load suggested curators for zero-follow state
  useEffect(() => {
    if (tab !== "my-feed" || !isLoggedIn) return;
    fetch("/api/curators")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const sorted = data.sort((a: Curator, b: Curator) =>
            (b.follower_counts?.count ?? 0) - (a.follower_counts?.count ?? 0)
          );
          setSuggestedCurators(sorted.slice(0, 3));
        }
      })
      .catch(() => {});
  }, [tab, isLoggedIn]);

  // Fetch feed
  useEffect(() => {
    setLoading(true);
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setTotal(0);
    setError(null);

    const feedMode = tab === "my-feed" ? "your" : "discover";
    const params = new URLSearchParams({ sort: "latest", offset: "0", limit: String(PAGE_SIZE) });
    params.set("feed", feedMode);
    if (feedMode === "discover" && discoverSeed) params.set("seed", discoverSeed);
    if (tagSlugs.length > 0) params.set("tags", tagSlugs.join(","));

    fetch(`/api/feed?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const pageItems: FeedItem[] = data.items ?? [];
        if (tab === "my-feed") {
          const seen = getSeenSources();
          setItems(boostUnseen(pageItems, seen));
        } else {
          setItems(pageItems);
        }
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setOffset(PAGE_SIZE);
      })
      .catch(() => setError("Couldn't load feed. Check your connection."))
      .finally(() => setLoading(false));
  }, [tab, tagSlugs.join(","), discoverSeed]);

  // Save seen sources on unmount
  useEffect(() => {
    return () => {
      const sourceTitles = items.map((i) => i.sourceTitle);
      if (sourceTitles.length > 0) saveSeenSources(sourceTitles);
    };
  }, [items]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const feedMode = tab === "my-feed" ? "your" : "discover";
    const params = new URLSearchParams({ sort: "latest", offset: String(offset), limit: String(PAGE_SIZE) });
    params.set("feed", feedMode);
    if (feedMode === "discover" && discoverSeed) params.set("seed", discoverSeed);
    if (tagSlugs.length > 0) params.set("tags", tagSlugs.join(","));

    fetch(`/api/feed?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const pageItems: FeedItem[] = data.items ?? [];
        let newItems = pageItems;
        if (tab === "my-feed") {
          const seen = getSeenSources();
          newItems = boostUnseen(pageItems, seen);
        }
        setItems((prev) => [...prev, ...newItems]);
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setOffset((prev) => prev + PAGE_SIZE);
      })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, offset, tab, tagSlugs, discoverSeed]);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => !local.removedSources.includes(item.sourceTitle))
      .filter((item) => !local.hiddenLinks.includes(item.link));
  }, [items, local]);

  const hasFollows = follows && (follows.curators.length > 0 || follows.sources.length > 0);
  const hasArticles = filteredItems.length > 0;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-4 mb-16">
      {/* Discover tab */}
      {tab === "discover" && (
        <>
          <WelcomeBanner />
          <FiltersBar />

          {loading ? (
            <div className="px-4 mt-4 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                  <div className="h-4 w-3/4 rounded bg-zinc-800 mb-3" />
                  <div className="h-3 w-full rounded bg-zinc-800 mb-2" />
                  <div className="h-3 w-1/2 rounded bg-zinc-800" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="px-4 mt-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-12 text-center">
                <p className="text-4xl mb-4">📡</p>
                <p className="text-zinc-400">Nothing here yet</p>
                <p className="mt-2 text-sm text-zinc-600">Try a different topic</p>
              </div>
            </div>
          ) : (
            <div className="px-4 mt-4 space-y-2">
              {filteredItems.map((item, i) => (
                <div key={`${item.link}-${i}`}>
                  <ArticleCard
                    item={item}
                    onRemoveSource={(src) => {
                      const next = [...local.removedSources, src];
                      localStorage.setItem("ic:removedSources", JSON.stringify(next));
                      window.dispatchEvent(new Event("ic:removedSources-updated"));
                    }}
                    hidden={false}
                    vote={local.votes[item.link] ?? 0}
                    showAddSource={true}
                    compact={false}
                  />
                  {/* Inject CuratorStrip after 6th article */}
                  {i === 5 && <CuratorStrip />}
                </div>
              ))}

              <div className="py-6 text-center">
                {hasMore ? (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-300 disabled:opacity-50"
                  >
                    {loadingMore ? "Loading..." : "Load More"}
                  </button>
                ) : filteredItems.length > 0 ? (
                  <p className="text-sm text-zinc-500">You have seen everything — check back later.</p>
                ) : null}
              </div>
            </div>
          )}
        </>
      )}

      {/* My Feed tab */}
      {tab === "my-feed" && (
        <>
          {isLoggedIn === null ? (
            /* Auth loading */
            <div className="px-4 mt-4 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                  <div className="h-4 w-3/4 rounded bg-zinc-800 mb-3" />
                  <div className="h-3 w-full rounded bg-zinc-800 mb-2" />
                  <div className="h-3 w-1/2 rounded bg-zinc-800" />
                </div>
              ))}
            </div>
          ) : !isLoggedIn ? (
            /* Logged out */
            <div className="px-4 mt-8">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-10 text-center">
                <h2 className="text-xl font-semibold text-zinc-100">
                  Build your reading feed
                </h2>
                <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto">
                  Follow curators and sources you trust to build a personalized feed of hand-picked articles.
                </p>
                <Link
                  href="/login"
                  className="mt-6 inline-block rounded-lg bg-zinc-800 px-6 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Sign In
                </Link>
              </div>
            </div>
          ) : !hasFollows ? (
            /* Logged in, zero follows */
            <div className="px-4 mt-8">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-zinc-100">
                  Start building your feed
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Follow curators whose taste you trust. Here are some to get started:
                </p>
              </div>
              <div className="space-y-3">
                {suggestedCurators.map((c) => (
                  <div key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-zinc-200">{c.display_name}</h4>
                        {c.bio && (
                          <p className="mt-1 text-sm text-zinc-500 line-clamp-1">{c.bio}</p>
                        )}
                        <p className="mt-1 text-xs text-zinc-600">
                          {c.follower_counts?.count ?? 0} follower{(c.follower_counts?.count ?? 0) !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <FollowButton targetType="curator" targetId={c.id} initialFollowed={false} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : loading ? (
            /* Loading feed */
            <div className="px-4 mt-4 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                  <div className="h-4 w-3/4 rounded bg-zinc-800 mb-3" />
                  <div className="h-3 w-full rounded bg-zinc-800 mb-2" />
                  <div className="h-3 w-1/2 rounded bg-zinc-800" />
                </div>
              ))}
            </div>
          ) : !hasArticles ? (
            /* Has follows but no articles yet */
            <div className="px-4 mt-8">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-10 text-center">
                <h2 className="text-xl font-semibold text-zinc-100">
                  Your curators haven&apos;t published yet
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Check back soon.
                </p>
                {follows && follows.curators.length > 0 && (
                  <p className="mt-3 text-xs text-zinc-500">
                    Following {follows.curators.length} curator{follows.curators.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Has articles */
            <div className="px-4 mt-4 space-y-2">
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
                  showAddSource={false}
                  compact={false}
                />
              ))}
              <div className="py-6 text-center">
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
        </>
      )}
    </main>
  );
}
