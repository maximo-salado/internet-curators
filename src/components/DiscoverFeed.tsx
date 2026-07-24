"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ArticleCard } from "@/components/ArticleCard";
import { TopSources, type TopSource } from "@/components/TopSources";

export interface FeedItem {
  articleId: string;
  title: string;
  link: string;
  pubDate: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceId?: string;
  contentSnippet: string;
  content?: string;
  image?: string;
  upvotes?: number;
  downvotes?: number;
}

interface DiscoverFeedProps {
  tagSlugs?: string[];
  isLoggedIn?: boolean;
}

const PAGE_SIZE = 20;

export function DiscoverFeed({ tagSlugs = [], isLoggedIn = false }: DiscoverFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topSources, setTopSources] = useState<TopSource[]>([]);

  // Per-article user actions (hydrated from GET /api/actions)
  const [userActionsMap, setUserActionsMap] = useState<Record<string, string[]>>({});

  const [discoverSeed] = useState(() => {
    if (typeof window === "undefined") return "";
    const stored = sessionStorage.getItem("ic:discover-seed");
    if (stored) return stored;
    const seed = String(Math.floor(Math.random() * 1000000));
    sessionStorage.setItem("ic:discover-seed", seed);
    return seed;
  });

  // Local storage state for votes, hidden links, removed sources
  const [local, setLocal] = useState(() => {
    if (typeof window === "undefined")
      return { votes: {}, hiddenLinks: [], removedSources: [] };
    return {
      votes: JSON.parse(
        localStorage.getItem("ic:votes") ?? "{}",
      ) as Record<string, number>,
      hiddenLinks: JSON.parse(
        localStorage.getItem("ic:hidden") ?? "[]",
      ) as string[],
      removedSources: JSON.parse(
        localStorage.getItem("ic:removedSources") ?? "[]",
      ) as string[],
    };
  });

  const syncLocal = useCallback(() => {
    if (typeof window === "undefined") return;
    setLocal({
      votes: JSON.parse(localStorage.getItem("ic:votes") ?? "{}"),
      hiddenLinks: JSON.parse(localStorage.getItem("ic:hidden") ?? "[]"),
      removedSources: JSON.parse(
        localStorage.getItem("ic:removedSources") ?? "[]",
      ),
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

  // Hydrate user actions for a batch of article IDs
  const hydrateUserActions = useCallback(async (articleIds: string[]) => {
    if (!isLoggedIn || articleIds.length === 0) return;
    try {
      const res = await fetch(`/api/actions?articleIds=${articleIds.join(",")}`);
      const data: Record<string, string[]> = await res.json();
      setUserActionsMap((prev) => ({ ...prev, ...data }));
    } catch {
      // Silently fail — actions just won't show active state
    }
  }, [isLoggedIn]);

  // Fetch top sources on mount
  useEffect(() => {
    fetch("/api/sources/top?limit=10")
      .then((r) => r.json())
      .then((data) => {
        setTopSources(data.sources ?? []);
      })
      .catch(() => {});
  }, []);

  // Hydrate user actions whenever items change AND user is logged in
  useEffect(() => {
    if (!isLoggedIn || items.length === 0) return;
    const ids = items.map((it) => it.articleId).filter(Boolean);
    hydrateUserActions(ids);
  }, [items.length, isLoggedIn, hydrateUserActions]);

  // Fetch feed (only depends on tagSlugs and seed, NOT isLoggedIn)
  useEffect(() => {
    setLoading(true);
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setTotal(0);
    setError(null);

    const params = new URLSearchParams({
      sort: "latest",
      offset: "0",
      limit: String(PAGE_SIZE),
    });
    params.set("feed", "discover");
    if (discoverSeed) params.set("seed", discoverSeed);
    if (tagSlugs.length > 0) params.set("tags", tagSlugs.join(","));

    fetch(`/api/feed?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const pageItems: FeedItem[] = data.items ?? [];
        setItems(pageItems);
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setOffset(PAGE_SIZE);
      })
      .catch(() => setError("Couldn't load feed. Check your connection."))
      .finally(() => setLoading(false));
  }, [tagSlugs.join(","), discoverSeed]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    const params = new URLSearchParams({
      sort: "latest",
      offset: String(offset),
      limit: String(PAGE_SIZE),
    });
    params.set("feed", "discover");
    if (discoverSeed) params.set("seed", discoverSeed);
    if (tagSlugs.length > 0) params.set("tags", tagSlugs.join(","));

    fetch(`/api/feed?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const pageItems: FeedItem[] = data.items ?? [];
        setItems((prev) => [...prev, ...pageItems]);
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setOffset((prev) => prev + PAGE_SIZE);

        // Hydrate user actions for new batch
        const ids = pageItems.map((it: FeedItem) => it.articleId).filter(Boolean);
        hydrateUserActions(ids);
      })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, offset, tagSlugs, discoverSeed, hydrateUserActions]);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => !local.removedSources.includes(item.sourceTitle))
      .filter((item) => !local.hiddenLinks.includes(item.link))
      .filter((item) => {
        // Client-side dismiss filtering for logged-in users
        if (!isLoggedIn) return true;
        const actions = userActionsMap[item.articleId] ?? [];
        return !actions.includes("dismiss");
      });
  }, [items, local, isLoggedIn, userActionsMap]);

  // Find insertion point for TopSources (after 10th article)
  const topSourcesIndex = 10;

  if (loading) {
    return (
      <div className="px-4 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-5"
          >
            <div className="h-4 w-3/4 rounded bg-zinc-800 mb-3" />
            <div className="h-3 w-full rounded bg-zinc-800 mb-2" />
            <div className="h-3 w-1/2 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-12 text-center">
          <p className="text-4xl mb-4">📡</p>
          <p className="text-zinc-400">Nothing here yet</p>
          <p className="mt-2 text-sm text-zinc-600">Try a different topic</p>
        </div>
      </div>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <div className="px-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-12 text-center">
          <p className="text-4xl mb-4">📡</p>
          <p className="text-zinc-400">No articles found</p>
          <p className="mt-2 text-sm text-zinc-600">
            Try adjusting your filters or check back later
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 space-y-2">
      {filteredItems.map((item, i) => {
        const elements: React.ReactNode[] = [];

        // Article card
        elements.push(
          <ArticleCard
            key={`${item.link}-${i}`}
            item={item}
            articleId={item.articleId}
            onRemoveSource={(src) => {
              const next = [...local.removedSources, src];
              localStorage.setItem("ic:removedSources", JSON.stringify(next));
              window.dispatchEvent(new Event("ic:removedSources-updated"));
            }}
            hidden={false}
            isLoggedIn={isLoggedIn}
            userActions={userActionsMap[item.articleId] ?? []}
          />,
        );

        // Inject TopSources after the 10th article
        if (i === topSourcesIndex - 1 && topSources.length > 0) {
          elements.push(
            <div key="top-sources" className="py-2">
              <TopSources sources={topSources} />
            </div>,
          );
        }

        return elements;
      })}

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
          <p className="text-sm text-zinc-500">
            You have seen everything — check back later.
          </p>
        ) : null}
      </div>
    </div>
  );
}
