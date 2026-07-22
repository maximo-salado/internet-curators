"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MobilePopup } from "./MobilePopup";

interface Tag {
  id: string;
  name: string;
  slug: string;
  facet: string;
  parent_id: string | null;
  display_order: number;
}

interface FiltersBarProps {
  onFilterChange?: (slugs: string[]) => void;
  activeTagSlugs?: string[];
}

export function FiltersBar({ onFilterChange, activeTagSlugs }: FiltersBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const controlled = typeof onFilterChange === "function" && Array.isArray(activeTagSlugs);
  const tagSlugs = controlled ? (activeTagSlugs ?? []) : (searchParams.get("tags")?.split(",").filter(Boolean) ?? []);

  const [topicTags, setTopicTags] = useState<Tag[]>([]);
  const [voiceTags, setVoiceTags] = useState<Tag[]>([]);
  const [stanceTags, setStanceTags] = useState<Tag[]>([]);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [stanceOpen, setStanceOpen] = useState(false);
  const [expandedTopicParents, setExpandedTopicParents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const filterRowRef = useRef<HTMLDivElement>(null);

  // Build parent->children map for topics
  const parentToChildren = new Map<string, Tag[]>();
  for (const t of topicTags) {
    const key = t.parent_id ?? ("__root__" as any);
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

  const updateTags = useCallback(
    (slug: string) => {
      if (controlled) {
        const current = activeTagSlugs ?? [];
        const matchingTag = [...topicTags, ...voiceTags, ...stanceTags].find((t) => t.slug === slug);
        if (!matchingTag) return;

        const sameFacet = [...topicTags, ...voiceTags, ...stanceTags]
          .filter((t) => t.facet === matchingTag.facet)
          .map((t) => t.slug);
        const sameFacetSet = new Set(sameFacet);

        const filtered = current.filter((s) => !sameFacetSet.has(s));
        if (slug !== "all" && !current.includes(slug)) {
          filtered.push(slug);
        }
        onFilterChange!(filtered);
        return;
      }

      const params = new URLSearchParams(searchParams.toString());
      const current = params.get("tags")?.split(",").filter(Boolean) ?? [];

      const matchingTag = [...topicTags, ...voiceTags, ...stanceTags].find((t) => t.slug === slug);
      if (!matchingTag) return;

      const sameFacet = [...topicTags, ...voiceTags, ...stanceTags]
        .filter((t) => t.facet === matchingTag.facet)
        .map((t) => t.slug);
      const sameFacetSet = new Set(sameFacet);

      const filtered = current.filter((s) => !sameFacetSet.has(s));

      if (slug !== "all" && !current.includes(slug)) {
        filtered.push(slug);
      }

      if (filtered.length > 0) {
        params.set("tags", filtered.join(","));
      } else {
        params.delete("tags");
      }
      router.replace(`/?${params.toString()}`, { scroll: false });
    },
    [controlled, activeTagSlugs, onFilterChange, searchParams, router, topicTags, voiceTags, stanceTags],
  );

  const clearFacet = useCallback(
    (facet: string) => {
      if (controlled) {
        const current = activeTagSlugs ?? [];
        const facetSlugs = [...topicTags, ...voiceTags, ...stanceTags]
          .filter((t) => t.facet === facet)
          .map((t) => t.slug);
        const facetSet = new Set(facetSlugs);
        onFilterChange!(current.filter((s) => !facetSet.has(s)));
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      const current = params.get("tags")?.split(",").filter(Boolean) ?? [];
      const facetSlugs = [...topicTags, ...voiceTags, ...stanceTags]
        .filter((t) => t.facet === facet)
        .map((t) => t.slug);
      const facetSet = new Set(facetSlugs);
      const filtered = current.filter((s) => !facetSet.has(s));
      if (filtered.length > 0) {
        params.set("tags", filtered.join(","));
      } else {
        params.delete("tags");
      }
      router.replace(`/?${params.toString()}`, { scroll: false });
    },
    [controlled, activeTagSlugs, onFilterChange, searchParams, router, topicTags, voiceTags, stanceTags],
  );

  const clearAll = useCallback(() => {
    if (controlled) {
      onFilterChange!([]);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tags");
    router.replace(`/?${params.toString()}`, { scroll: false });
  }, [controlled, onFilterChange, searchParams, router]);

  const hasFilters = activeFilterCount > 0;

  useEffect(() => {
    if (!voiceOpen && !stanceOpen && !topicsOpen) return;
    function handleClick(e: MouseEvent) {
      if (filterRowRef.current && !filterRowRef.current.contains(e.target as Node)) {
        setVoiceOpen(false);
        setStanceOpen(false);
        setTopicsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [voiceOpen, stanceOpen, topicsOpen]);

  const toggleTopicParent = (parentId: string) => {
    setExpandedTopicParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const renderTopicTree = (topics: Tag[], depth: number = 0): React.ReactNode[] => {
    return topics.flatMap((t) => {
      const children = parentToChildren.get(t.id) ?? [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedTopicParents.has(t.id);

      const items: React.ReactNode[] = [
        <button
          key={t.id}
          onClick={() => {
            updateTags(t.slug);
            setTopicsOpen(false);
          }}
          className={`w-full text-left text-sm transition-colors flex items-center justify-between min-h-[44px] ${
            activeTopic === t.slug
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
          }`}
          style={{
            paddingLeft: `${12 + depth * 16}px`,
            paddingRight: "12px",
            paddingTop: "10px",
            paddingBottom: "10px",
          }}
        >
          <span>{t.name}</span>
          {hasChildren && (
            <span
              className={`text-xs transition-transform ${isExpanded ? "rotate-90" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleTopicParent(t.id);
              }}
            >
              ▸
            </span>
          )}
        </button>,
      ];

      if (hasChildren && isExpanded) {
        items.push(...renderTopicTree(children, depth + 1));
      }

      return items;
    });
  };

  return (
    <div className="border-b border-zinc-800">
      {/* Spinner during load */}
      {loading && (
        <div className="flex items-center gap-2 px-4 py-2">
          {[80, 65, 55].map((w, i) => (
            <div
              key={i}
              className="shrink-0 animate-pulse rounded-full bg-zinc-800 h-8"
              style={{ width: w }}
            />
          ))}
        </div>
      )}

      {/* Filter controls row */}
      {!loading && (
        <div ref={filterRowRef} className="flex flex-nowrap items-center gap-2 px-4 py-2 border-t border-zinc-800/50 min-w-0">
          {/* Topics dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setTopicsOpen(!topicsOpen);
                setVoiceOpen(false);
                setStanceOpen(false);
              }}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors min-h-[44px] ${
                activeTopic
                  ? "bg-zinc-200 text-zinc-900"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {activeTopic
                ? topicTags.find((t) => t.slug === activeTopic)?.name ?? "Topics"
                : "Topics ▾"}
            </button>
            {topicsOpen && (
              <div className="hidden md:block absolute left-0 top-8 mt-1 w-56 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl z-50 max-h-64 overflow-y-auto">
                <button
                  onClick={() => { clearAll(); setTopicsOpen(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors min-h-[44px] ${
                    !activeTopic ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                  }`}>All</button>
                {renderTopicTree(rootTopics)}
              </div>
            )}
            <MobilePopup isOpen={topicsOpen} onClose={() => setTopicsOpen(false)}>
              <button
                onClick={() => { clearAll(); setTopicsOpen(false); }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors min-h-[44px] ${
                  !activeTopic ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                }`}>All</button>
              {renderTopicTree(rootTopics)}
            </MobilePopup>
          </div>

          {/* Voice dropdown */}
          <div className="relative">
            <button
              onClick={() => { setVoiceOpen(!voiceOpen); setStanceOpen(false); setTopicsOpen(false); }}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors min-h-[44px] ${
                activeVoice ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}>
              {activeVoice ? voiceTags.find((t) => t.slug === activeVoice)?.name ?? "Voice" : "Voice ▾"}
            </button>
            {voiceOpen && (
              <div className="hidden md:block absolute left-0 top-8 mt-1 w-44 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl z-50 max-h-64 overflow-y-auto">
                <button onClick={() => { clearFacet("voice"); setVoiceOpen(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors min-h-[44px] ${
                    !activeVoice ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                  }`}>All</button>
                {voiceTags.map((t) => (
                  <button key={t.id} onClick={() => { updateTags(t.slug); setVoiceOpen(false); }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors min-h-[44px] ${
                      activeVoice === t.slug ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                    }`}>{t.name}</button>
                ))}
              </div>
            )}
            <MobilePopup isOpen={voiceOpen} onClose={() => setVoiceOpen(false)}>
              <button onClick={() => { clearFacet("voice"); setVoiceOpen(false); }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors min-h-[44px] ${
                  !activeVoice ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                }`}>All</button>
              {voiceTags.map((t) => (
                <button key={t.id} onClick={() => { updateTags(t.slug); setVoiceOpen(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors min-h-[44px] ${
                    activeVoice === t.slug ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                  }`}>{t.name}</button>
              ))}
            </MobilePopup>
          </div>

          {/* Stance dropdown */}
          <div className="relative">
            <button
              onClick={() => { setStanceOpen(!stanceOpen); setVoiceOpen(false); setTopicsOpen(false); }}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors min-h-[44px] ${
                activeStance ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}>
              {activeStance ? stanceTags.find((t) => t.slug === activeStance)?.name ?? "Stance" : "Stance ▾"}
            </button>
            {stanceOpen && (
              <div className="hidden md:block absolute left-0 top-8 mt-1 w-44 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl z-50 max-h-64 overflow-y-auto">
                <button onClick={() => { clearFacet("stance"); setStanceOpen(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors min-h-[44px] ${
                    !activeStance ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                  }`}>All</button>
                {stanceTags.map((t) => (
                  <button key={t.id} onClick={() => { updateTags(t.slug); setStanceOpen(false); }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors min-h-[44px] ${
                      activeStance === t.slug ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                    }`}>{t.name}</button>
                ))}
              </div>
            )}
            <MobilePopup isOpen={stanceOpen} onClose={() => setStanceOpen(false)}>
              <button onClick={() => { clearFacet("stance"); setStanceOpen(false); }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors min-h-[44px] ${
                  !activeStance ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                }`}>All</button>
              {stanceTags.map((t) => (
                <button key={t.id} onClick={() => { updateTags(t.slug); setStanceOpen(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors min-h-[44px] ${
                    activeStance === t.slug ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                  }`}>{t.name}</button>
              ))}
            </MobilePopup>
          </div>

          {/* Clear button */}
          {hasFilters && (
            <button
              onClick={clearAll}
              className="ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300 transition-colors shrink-0"
            >
              ✕ Clear ({activeFilterCount})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
