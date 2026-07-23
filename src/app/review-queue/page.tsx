"use client";

import { useEffect, useState, useMemo } from "react";
import { FiltersBar } from "@/components/FiltersBar";
import { SourceReviewCard } from "@/components/SourceReviewCard";

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
    // Metadata
    _enrichment_failed?: boolean;
    _enrichment_attempted?: boolean;
  };
  status: string;
  discovered_at: string;
}

interface Tag {
  id: string;
  name: string;
  slug: string;
  facet: string;
  parent_id: string | null;
}

export default function ReviewQueuePage() {
  const [isEditor, setIsEditor] = useState<boolean | null>(null);
  const [sources, setSources] = useState<DiscoveredSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<string>("pending");
  const [filterTagSlugs, setFilterTagSlugs] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);

  // Fetch tags for slug→name mapping (used for client-side filtering)
  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data) => setAllTags(data.tags ?? []))
      .catch(() => {});
  }, []);

  // Build slug→name map
  const slugToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const tag of allTags) {
      map.set(tag.slug, tag.name.toLowerCase());
    }
    return map;
  }, [allTags]);

  useEffect(() => {
    fetch(`/api/discover/sources?status=${activeStatus}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        if (data.isEditor) {
          setIsEditor(true);
          setSources(data.items ?? []);
          setFilterTagSlugs([]); // reset filters on tab switch
          enrichSources(data.items ?? []);
        } else {
          setIsEditor(false);
        }
      })
      .catch(() => setIsEditor(false))
      .finally(() => setLoading(false));
  }, [activeStatus]);

  // Client-side filter: match source.suggested_tags against active filter slugs
  const filteredSources = useMemo(() => {
    let result = sources;

    if (filterTagSlugs.length > 0) {
      const filterNames = filterTagSlugs
        .map((slug) => slugToName.get(slug))
        .filter(Boolean) as string[];
      if (filterNames.length > 0) {
        result = sources.filter((source) => {
          if (!source.suggested_tags || source.suggested_tags.length === 0) return false;
          return source.suggested_tags.some((t) =>
            filterNames.includes(t.toLowerCase())
          );
        });
      }
    }

    return result;
  }, [sources, filterTagSlugs, slugToName]);

  const enrichSources = async (items: DiscoveredSource[]) => {
    const pending = items.filter((source) => {
      const sig = (source.independence_signals ?? {}) as Record<string, unknown>;
      return !sig._enrichment_attempted;
    });
    if (pending.length === 0) return;

    const BATCH = 5;
    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((source) =>
          fetch("/api/discover/sources/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source_id: source.id }),
          }).then((r) => r.json())
        )
      );

      results.forEach((result, j) => {
        if (result.status !== "fulfilled") return;
        const data = result.value;
        if (data.enriched) {
          setSources((prev) =>
            prev.map((s) =>
              s.id === batch[j].id
                ? { ...s, independence_signals: { ...s.independence_signals, _enrichment_attempted: true } }
                : s
            )
          );
        }
      });
    }
  };

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

      <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1 mb-6">
        {(["pending", "approved", "rejected", "parked"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveStatus(tab)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              activeStatus === tab
                ? "bg-zinc-700 text-white shadow"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <FiltersBar
        onFilterChange={setFilterTagSlugs}
        activeTagSlugs={filterTagSlugs}
      />

      {filteredSources.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-12 text-center">
          {filterTagSlugs.length > 0 ? (
            <p className="text-zinc-400">No {activeStatus} sources match the selected filters.</p>
          ) : (
            <p className="text-zinc-400">No {activeStatus} sources to review.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSources.map((source) => (
            <SourceReviewCard
              key={source.id}
              source={source}
              isEditor={true}
              onTransition={(id) => {
                setSources((prev) => prev.filter((s) => s.id !== id));
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
