"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { ArticleCard } from "@/components/ArticleCard";

interface SavedItem {
  id: string;
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

const PAGE_SIZE = 20;

export default function SavedPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-article user actions (all should be "save" initially)
  const [userActionsMap, setUserActionsMap] = useState<Record<string, string[]>>({});

  // Hydrate user actions for saved articles
  const hydrateUserActions = useCallback(async (articleIds: string[]) => {
    if (!user || articleIds.length === 0) return;
    try {
      const res = await fetch(`/api/actions?articleIds=${articleIds.join(",")}`);
      const data: Record<string, string[]> = await res.json();
      setUserActionsMap((prev) => ({ ...prev, ...data }));
    } catch {
      // Silently fail
    }
  }, [user]);

  // Track locally removed items (when user clicks Remove)
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?next=" + encodeURIComponent("/saved"));
    }
  }, [authLoading, user, router]);

  // Fetch initial batch
  useEffect(() => {
    if (authLoading || !user) return;

    setLoading(true);
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setTotal(0);
    setError(null);

    fetch(`/api/saved?offset=0&limit=${PAGE_SIZE}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        const pageItems: SavedItem[] = data.items ?? [];
        setItems(pageItems);
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setOffset(PAGE_SIZE);

        // Hydrate user actions for this batch
        const ids = pageItems.map((it) => it.id).filter(Boolean);
        hydrateUserActions(ids);
      })
      .catch(() => setError("Couldn't load saved articles. Check your connection."))
      .finally(() => setLoading(false));
    // We only want this to run once on mount or when auth resolves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    fetch(`/api/saved?offset=${offset}&limit=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((data) => {
        const pageItems: SavedItem[] = data.items ?? [];
        setItems((prev) => [...prev, ...pageItems]);
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setOffset((prev) => prev + PAGE_SIZE);

        // Hydrate user actions for new batch
        const ids = pageItems.map((it) => it.id).filter(Boolean);
        hydrateUserActions(ids);
      })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, offset, hydrateUserActions]);

  // Show loading state
  if (authLoading || (loading && items.length === 0 && !error)) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 mb-16">
        <h1 className="text-xl font-semibold text-zinc-100 mb-4">Saved</h1>
        <div className="space-y-4">
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
      </main>
    );
  }

  // Don't show anything while redirecting
  if (!user) {
    return null;
  }

  // Filter out locally removed items
  const visibleItems = items.filter((it) => !removedIds.has(it.id));

  if (error) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 mb-16">
        <h1 className="text-xl font-semibold text-zinc-100 mb-4">Saved</h1>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-12 text-center">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-zinc-400">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 mb-16">
      <h1 className="text-xl font-semibold text-zinc-100 mb-4">Saved</h1>

      {visibleItems.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-12 text-center">
          <p className="text-4xl mb-4">🔖</p>
          <p className="text-zinc-400">Nothing saved yet</p>
          <p className="mt-2 text-sm text-zinc-600">
            Browse the feed to find articles.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg bg-zinc-800 px-5 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Go to feed
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item, i) => (
            <ArticleCard
              key={`${item.link}-${i}`}
              item={{
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                sourceTitle: item.sourceTitle,
                sourceUrl: item.sourceUrl,
                sourceId: item.sourceId,
                curatorNames: [],
                curatorIds: [],
                contentSnippet: item.contentSnippet,
                content: item.content,
                image: item.image,
                upvotes: item.upvotes,
                downvotes: item.downvotes,
              }}
              articleId={item.id}
              onRemoveSource={() => {}}
              hidden={false}
              isLoggedIn={true}
              userActions={userActionsMap[item.id] ?? ["save"]}
              showRemoveAction
            />
          ))}

          {/* Pagination */}
          <div className="py-6 text-center">
            {hasMore ? (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-300 disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            ) : visibleItems.length > 0 ? (
              <p className="text-sm text-zinc-500">
                That's everything you've saved.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
