"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Tag {
  id: string;
  name: string;
  slug: string;
  facet: string;
  parent_id: string | null;
  display_order: number;
}

export function FiltersBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tagSlugs = searchParams.get("tags")?.split(",").filter(Boolean) ?? [];

  const [topicTags, setTopicTags] = useState<Tag[]>([]);
  const [voiceTags, setVoiceTags] = useState<Tag[]>([]);
  const [stanceTags, setStanceTags] = useState<Tag[]>([]);
  const [topicsExpanded, setTopicsExpanded] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [stanceOpen, setStanceOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const filterRowRef = useRef<HTMLDivElement>(null);

  // Build parent->children map for topics
  const parentToChildren = new Map<string | null, Tag[]>();
  for (const t of topicTags) {
    const key = t.parent_id ?? "__root__" as any;
    if (!parentToChildren.has(key)) parentToChildren.set(key, []);
    parentToChildren.get(key)!.push(t);
  }

  // Only parent-level topics (those with parent_id = null or whose parent is not a topic)
  const parentTopicIds = new Set(topicTags.map((t) => t.parent_id).filter(Boolean));
  const rootTopics = topicTags.filter((t) => !t.parent_id || !parentTopicIds.has(t.parent_id));

  useEffect(() => {
    Promise.all([
      fetch("/api/tags?facet=topic").then((r) => r.json()),
      fetch("/api/tags?facet=voice").then((r) => r.json()),
      fetch("/api/tags?facet=stance").then((r) => r.json()),
    ])
      .then(([topicData, voiceData, stanceData]) => {
        setTopicTags((topicData.tags || topicData) ?? []);
        setVoiceTags((voiceData.tags || voiceData) ?? []);
        setStanceTags((stanceData.tags || stanceData) ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeTopic = tagSlugs.find((s) => topicTags.some((t) => t.slug === s)) ?? null;
  const activeVoice = tagSlugs.find((s) => voiceTags.some((t) => t.slug === s)) ?? null;
  const activeStance = tagSlugs.find((s) => stanceTags.some((t) => t.slug === s)) ?? null;

  const activeFilterCount = [activeTopic, activeVoice, activeStance].filter(Boolean).length;

  const updateTags = useCallback((slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.get("tags")?.split(",").filter(Boolean) ?? [];

    // Remove any existing tag from the same facet group
    const allTagSlugs = [...topicTags, ...voiceTags, ...stanceTags].map((t) => t.slug);
    const matchingTag = [...topicTags, ...voiceTags, ...stanceTags].find((t) => t.slug === slug);
    if (!matchingTag) return;

    // Build set of slugs from the same facet
    const sameFacet = [...topicTags, ...voiceTags, ...stanceTags]
      .filter((t) => t.facet === matchingTag.facet)
      .map((t) => t.slug);
    const sameFacetSet = new Set(sameFacet);

    const filtered = current.filter((s) => !sameFacetSet.has(s));

    // If not already selected, add it
    if (slug !== "all" && !current.includes(slug)) {
      filtered.push(slug);
    }

    if (filtered.length > 0) {
      params.set("tags", filtered.join(","));
    } else {
      params.delete("tags");
    }
    router.replace(`/?${params.toString()}`, { scroll: false });
  }, [searchParams, router, topicTags, voiceTags, stanceTags]);

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tags");
    router.replace(`/?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const hasFilters = activeFilterCount > 0;

  useEffect(() => {
    if (!voiceOpen && !stanceOpen) return;
    function handleClick(e: MouseEvent) {
      if (filterRowRef.current && !filterRowRef.current.contains(e.target as Node)) {
        setVoiceOpen(false);
        setStanceOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [voiceOpen, stanceOpen]);

  return (
    <div className="border-b border-zinc-800">
      {/* Topic strip */}
      <div className="relative">
        {loading ? (
          <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide">
            {[120, 85, 100, 70, 90, 110].map((w, i) => (
              <div key={i} className="shrink-0 animate-pulse rounded-full bg-zinc-800 h-8" style={{ width: w }} />
            ))}
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide">
            <button
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete("tags");
                router.replace(`/?${params.toString()}`, { scroll: false });
              }}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                !activeTopic
                  ? "bg-zinc-200 text-zinc-900"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
              }`}
            >
              All
            </button>
            {(topicsExpanded ? topicTags : rootTopics.slice(0, 6)).map((t) => (
              <button
                key={t.id}
                onClick={() => updateTags(t.slug)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTopic === t.slug
                    ? "bg-zinc-200 text-zinc-900"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
                }`}
              >
                {t.name}
              </button>
            ))}
            {!topicsExpanded && rootTopics.length > 6 && (
              <button
                onClick={() => setTopicsExpanded(true)}
                className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
              >
                More ▸
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter controls row */}
      <div ref={filterRowRef} className="flex items-center gap-2 px-4 py-2 border-t border-zinc-800/50">
          {/* Voice dropdown */}
          <div className="relative">
            <button
              onClick={() => { setVoiceOpen(!voiceOpen); setStanceOpen(false); }}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeVoice ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {activeVoice ? voiceTags.find((t) => t.slug === activeVoice)?.name ?? "Voice" : "Voice ▾"}
            </button>
            {voiceOpen && (
              <div className="absolute left-0 top-8 w-44 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl z-50 max-h-64 overflow-y-auto">
                {voiceTags.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { updateTags(t.slug); setVoiceOpen(false); }}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      activeVoice === t.slug ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stance dropdown */}
          <div className="relative">
            <button
              onClick={() => { setStanceOpen(!stanceOpen); setVoiceOpen(false); }}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeStance ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {activeStance ? stanceTags.find((t) => t.slug === activeStance)?.name ?? "Stance" : "Stance ▾"}
            </button>
            {stanceOpen && (
              <div className="absolute left-0 top-8 w-44 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl z-50 max-h-64 overflow-y-auto">
                {stanceTags.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { updateTags(t.slug); setStanceOpen(false); }}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      activeStance === t.slug ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clear button */}
          {hasFilters && (
            <button
              onClick={clearAll}
              className="ml-auto flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            >
              ✕ Clear ({activeFilterCount})
            </button>
          )}
        </div>
    </div>
  );
}
