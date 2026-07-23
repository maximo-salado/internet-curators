"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ReviewSection } from "./ReviewSection";
import { TagSelector } from "./TagSelector";
import { PostsSection } from "./PostsSection";

interface Tag {
  id: string;
  name: string;
  slug: string;
  facet: string;
  parent_id: string | null;
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
  independence_signals: Record<string, unknown>;
  status: string;
  discovered_at: string;
}

const TAG_FACETS = ["topic", "stance", "format", "trust", "infra", "platform", "language"] as const;

const ACTION_LABELS: Record<string, string> = {
  approve: "Approved",
  reject: "Rejected",
  pending: "Reverted to Pending",
  parked: "Parked",
};

export function ReviewDetailClient({
  source: initialSource,
  allTags,
}: {
  source: DiscoveredSource;
  allTags: Tag[];
}) {
  const [source, setSource] = useState(initialSource);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [lastSavedTagIds, setLastSavedTagIds] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  useEffect(() => {
    fetch(`/api/discover/sources/${source.id}/tags`)
      .then((r) => r.json())
      .then((data) => {
        const ids = new Set<string>((data.tag_ids ?? []) as string[]);
        setSelectedTagIds(ids);
        setLastSavedTagIds(new Set(ids));
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, [source.id]);

  const tagsByFacet = useCallback(
    (facet: string) => allTags.filter((t) => t.facet === facet),
    [allTags]
  );

  const selectedByFacet = useCallback(
    (facet: string) => tagsByFacet(facet).filter((t) => selectedTagIds.has(t.id)),
    [tagsByFacet, selectedTagIds]
  );

  const toggleSection = (name: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (prev.has(name)) { next.delete(name); } else { next.add(name); }
      return next;
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (prev.has(tagId)) { next.delete(tagId); } else { next.add(tagId); }
      return next;
    });
    setDirty(true);
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2500);
  };

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/discover/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_tags",
          tag_ids: [...selectedTagIds],
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setLastSavedTagIds(new Set(selectedTagIds));
      setDirty(false);
      showFeedback("Saved");
    } catch {
      showFeedback("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSelectedTagIds(new Set(lastSavedTagIds));
    setDirty(false);
    showFeedback("Reverted");
  };

  const handleAction = async (action: "approve" | "reject" | "pending" | "parked") => {
    if (saving) return;
    setSaving(true);
    try {
      if (dirty) {
        const saveRes = await fetch(`/api/discover/sources/${source.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_tags",
            tag_ids: [...selectedTagIds],
          }),
        });
        if (!saveRes.ok) throw new Error("Pre-action save failed");
        setLastSavedTagIds(new Set(selectedTagIds));
        setDirty(false);
      }

      const res = await fetch(`/api/discover/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          tag_ids: [...selectedTagIds],
        }),
      });
      if (!res.ok) throw new Error("Action failed");
      const data = await res.json();
      setSource((prev) => ({ ...prev, status: data.action }));
      showFeedback(ACTION_LABELS[action] || `${action}d`);
    } catch {
      showFeedback("Action failed");
    } finally {
      setSaving(false);
    }
  };

  const renderPill = (tag: Tag) => (
    <span key={tag.id} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
      {tag.name}
    </span>
  );

  if (initialLoading) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 mb-16">
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-16 rounded bg-zinc-800" />
          <div className="h-8 w-3/4 rounded bg-zinc-800" />
          <div className="h-4 w-full rounded bg-zinc-800" />
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 rounded bg-zinc-800" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 mb-16">
      {feedback && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm text-zinc-200 shadow-lg">
          {feedback}
        </div>
      )}

      <Link href="/review-queue" className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-300">
        ← Back to Queue
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-semibold text-zinc-100">{source.title || "Untitled Source"}</h1>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            source.status === "approved" ? "bg-green-900/50 text-green-300" :
            source.status === "rejected" ? "bg-red-900/50 text-red-300" :
            source.status === "parked" ? "bg-amber-900/50 text-amber-300" :
            "bg-zinc-800 text-zinc-400"
          }`}>
            {source.status}
          </span>
        </div>
        {source.description && (
          <p className="mt-3 text-zinc-400">{source.description}</p>
        )}
        {source.site_url && (
          <a href={source.site_url} target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-zinc-500 hover:text-zinc-300 underline underline-offset-2">
            {source.site_url.replace(/^https?:\/\//, "")} ↗
          </a>
        )}
        <p className="mt-2 text-xs text-zinc-600">
          Discovered {new Date(source.discovered_at).toLocaleDateString()}
          {source.platform && <span className="ml-2">· {source.platform}</span>}
          {source.language && <span className="ml-2">· {source.language.toUpperCase()}</span>}
        </p>
      </div>

      <div className="mb-6">
        {TAG_FACETS.map((facet) => {
          const selected = selectedByFacet(facet);
          return (
            <ReviewSection
              key={facet}
              label={facet.charAt(0).toUpperCase() + facet.slice(1)}
              expanded={expandedSections.has(facet)}
              onToggle={() => toggleSection(facet)}
              pills={
                <>
                  {selected.map(renderPill)}
                  {selected.length === 0 && (
                    <span className="text-[11px] text-zinc-600">none</span>
                  )}
                </>
              }
              editor={
                <TagSelector
                  allTags={tagsByFacet(facet)}
                  selectedTagIds={selectedTagIds}
                  onToggle={toggleTag}
                  facets={[facet]}
                />
              }
            />
          );
        })}

        <ReviewSection
          label="Posts"
          expanded={expandedSections.has("posts")}
          onToggle={() => toggleSection("posts")}
          pills={
            source.recent_posts && source.recent_posts.length > 0 ? (
              <span className="text-[11px] text-zinc-500">
                {source.recent_posts.length} post{source.recent_posts.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-[11px] text-zinc-600">none</span>
            )
          }
          editor={<PostsSection posts={source.recent_posts ?? []} />}
        />
      </div>

      {source.site_url && (
        <a href={source.site_url} target="_blank" rel="noopener noreferrer"
          className="inline-block text-sm text-zinc-400 hover:text-zinc-200 underline underline-offset-2 mb-6">
          Visit Source ↗
        </a>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="rounded-lg bg-emerald-900/30 border border-emerald-800 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-900/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={handleCancel}
          disabled={!dirty || saving}
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {source.status === "pending" && (
          <>
            <button onClick={() => handleAction("parked")} disabled={saving}
              className="rounded-lg bg-amber-900/30 border border-amber-800 px-3 py-2 text-sm text-amber-400 hover:bg-amber-900/50 disabled:opacity-50 transition-colors">
              Park
            </button>
            <button onClick={() => handleAction("approve")} disabled={saving}
              className="flex-1 rounded-lg bg-green-900/30 border border-green-800 px-3 py-2 text-sm font-medium text-green-400 hover:bg-green-900/50 disabled:opacity-50 transition-colors">
              ✓ Approve
            </button>
            <button onClick={() => handleAction("reject")} disabled={saving}
              className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-sm text-red-400 hover:bg-red-900/50 disabled:opacity-50 transition-colors">
              ✗ Reject
            </button>
          </>
        )}
        {source.status === "approved" && (
          <>
            <span className="text-sm text-green-400 self-center mr-auto">✓ Approved</span>
            <button onClick={() => handleAction("pending")} disabled={saving}
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 disabled:opacity-50 transition-colors">
              ↩ Pending
            </button>
            <button onClick={() => handleAction("reject")} disabled={saving}
              className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-sm text-red-400 hover:bg-red-900/50 disabled:opacity-50 transition-colors">
              ✗ Reject
            </button>
            <button onClick={() => handleAction("parked")} disabled={saving}
              className="rounded-lg bg-amber-900/30 border border-amber-800 px-3 py-2 text-sm text-amber-400 hover:bg-amber-900/50 disabled:opacity-50 transition-colors">
              Park
            </button>
          </>
        )}
        {source.status === "rejected" && (
          <>
            <span className="text-sm text-red-400 self-center mr-auto">✗ Rejected</span>
            <button onClick={() => handleAction("pending")} disabled={saving}
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 disabled:opacity-50 transition-colors">
              ↩ Pending
            </button>
            <button onClick={() => handleAction("approve")} disabled={saving}
              className="rounded-lg bg-green-900/30 border border-green-800 px-3 py-2 text-sm text-green-400 hover:bg-green-900/50 disabled:opacity-50 transition-colors">
              ✓ Approve
            </button>
            <button onClick={() => handleAction("parked")} disabled={saving}
              className="rounded-lg bg-amber-900/30 border border-amber-800 px-3 py-2 text-sm text-amber-400 hover:bg-amber-900/50 disabled:opacity-50 transition-colors">
              Park
            </button>
          </>
        )}
        {source.status === "parked" && (
          <>
            <span className="text-sm text-amber-400 self-center mr-auto">Parked</span>
            <button onClick={() => handleAction("pending")} disabled={saving}
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 disabled:opacity-50 transition-colors">
              ↩ Pending
            </button>
          </>
        )}
      </div>
    </main>
  );
}
