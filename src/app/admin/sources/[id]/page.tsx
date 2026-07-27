"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// ── Types ──────────────────────────────────────────

interface SourceTag {
  id: string;
  slug: string;
  name: string;
  facet: string;
}

interface AvailableTag {
  id: string;
  name: string;
  slug: string;
  facet: string;
  parent_id: string | null;
  display_order: number | null;
}

interface DiscoveredSource {
  id: string;
  title: string;
  site_url: string;
  feed_url: string;
  description: string | null;
  status: "pending" | "approved" | "rejected" | "parked";
  platform: string | null;
  discovered_at: string;
  reviewed_at: string | null;
  tags: SourceTag[];
  tag_ids: string[];
}

// ── Facet colours for tags ─────────────────────────

const FACET_COLORS: Record<string, string> = {
  topic: "bg-blue-900/40 text-blue-300 border-blue-800",
  voice: "bg-purple-900/40 text-purple-300 border-purple-800",
  format: "bg-amber-900/40 text-amber-300 border-amber-800",
  language: "bg-emerald-900/40 text-emerald-300 border-emerald-800",
  stance: "bg-rose-900/40 text-rose-300 border-rose-800",
};

function facetColor(facet: string): string {
  return FACET_COLORS[facet] ?? "bg-zinc-800 text-zinc-400 border-zinc-700";
}

// ── Page ───────────────────────────────────────────

export default function SourceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sourceId = params.id as string;

  const [source, setSource] = useState<DiscoveredSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  // Tag state
  const [allTags, setAllTags] = useState<AvailableTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [addTagSelect, setAddTagSelect] = useState("");
  const [addingTag, setAddingTag] = useState(false);

  // ── Fetch source ──────────────────────────────────

  const fetchSource = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/discover/sources/${sourceId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch source");
      }
      const data = await res.json();
      setSource(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  // ── Fetch all tags ────────────────────────────────

  const fetchAllTags = useCallback(async () => {
    setTagsLoading(true);
    try {
      const res = await fetch("/api/admin/tags");
      if (!res.ok) throw new Error("Failed to fetch tags");
      const data = await res.json();
      setAllTags(data);
    } catch {
      // non-critical
    } finally {
      setTagsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSource();
    fetchAllTags();
  }, [fetchSource, fetchAllTags]);

  // ── Review actions ────────────────────────────────

  const reviewAction = async (action: "approve" | "reject" | "parked") => {
    if (!source) return;
    setActingId(source.id);
    setError(null);
    try {
      const res = await fetch(`/api/discover/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Action failed");
      }
      await fetchSource();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActingId(null);
    }
  };

  const blacklistAction = async () => {
    if (!source) return;
    setActingId(source.id);
    setError(null);
    try {
      const blRes = await fetch("/api/admin/blacklisted-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feed_url: source.feed_url }),
      });
      if (!blRes.ok) {
        const data = await blRes.json();
        throw new Error(data.error || "Blacklist failed");
      }
      await reviewAction("reject");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActingId(null);
    }
  };

  // ── Tag add/remove ───────────────────────────────

  const removeTag = async (tagId: string) => {
    if (!source) return;
    const newTagIds = source.tag_ids.filter((id) => id !== tagId);
    await updateSourceTags(newTagIds);
  };

  const addTag = async () => {
    if (!source || !addTagSelect) return;
    const newTagIds = [...source.tag_ids, addTagSelect];
    setAddingTag(true);
    await updateSourceTags(newTagIds);
    setAddingTag(false);
    setAddTagSelect("");
  };

  const updateSourceTags = async (tagIds: string[]) => {
    if (!source) return;
    setError(null);
    try {
      const res = await fetch(`/api/discover/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_tags", tag_ids: tagIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update tags");
      }
      await fetchSource();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Loading / error states ────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-zinc-500">Loading source…</p>
      </div>
    );
  }

  if (error && !source) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/admin" className="mb-4 inline-block text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
          ← Back to Admin
        </Link>
        <div className="rounded-md border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/admin" className="mb-4 inline-block text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
          ← Back to Admin
        </Link>
        <p className="text-sm text-zinc-500">Source not found.</p>
      </div>
    );
  }

  // ── Computed values ──────────────────────────────

  const isActing = actingId === source.id;
  const availableTags = allTags.filter(
    (t) => !source.tag_ids.includes(t.id)
  );

  const tagsByFacet = new Map<string, AvailableTag[]>();
  for (const t of availableTags) {
    const list = tagsByFacet.get(t.facet) ?? [];
    list.push(t);
    tagsByFacet.set(t.facet, list);
  }

  // Sort facets for display
  const facetOrder = ["topic", "voice", "format", "language", "stance"];
  const sortedFacets = facetOrder.filter((f) => tagsByFacet.has(f));

  // ── Render ────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        ← Back to Admin
      </Link>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold text-zinc-100 break-words">
            {source.title}
          </h1>
          <span
            className={`shrink-0 inline-block rounded-full px-3 py-1 text-xs font-medium ${
              source.status === "pending"
                ? "bg-yellow-900/40 text-yellow-300 border border-yellow-800"
                : source.status === "approved"
                ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800"
                : source.status === "rejected"
                ? "bg-red-900/40 text-red-300 border border-red-800"
                : "bg-zinc-800 text-zinc-400 border border-zinc-700"
            }`}
          >
            {source.status}
          </span>
        </div>
      </div>

      {/* Source info grid */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Feed URL */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-1 text-xs font-medium text-zinc-500">Feed URL</div>
          <a
            href={source.feed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-300 hover:text-zinc-100 break-all transition-colors"
          >
            {source.feed_url}
          </a>
        </div>

        {/* Site URL */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-1 text-xs font-medium text-zinc-500">Site URL</div>
          <a
            href={source.site_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-300 hover:text-zinc-100 break-all transition-colors"
          >
            {source.site_url}
          </a>
        </div>

        {/* Platform */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-1 text-xs font-medium text-zinc-500">Platform</div>
          <div className="text-sm text-zinc-300">
            {source.platform ?? "—"}
          </div>
        </div>

        {/* Discovered at */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-1 text-xs font-medium text-zinc-500">Discovered</div>
          <div className="text-sm text-zinc-300">
            {new Date(source.discovered_at).toLocaleString()}
          </div>
        </div>

        {/* Reviewed at */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-1 text-xs font-medium text-zinc-500">Reviewed</div>
          <div className="text-sm text-zinc-300">
            {source.reviewed_at
              ? new Date(source.reviewed_at).toLocaleString()
              : "—"}
          </div>
        </div>

        {/* Description */}
        {source.description && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 sm:col-span-2">
            <div className="mb-1 text-xs font-medium text-zinc-500">Description</div>
            <p className="text-sm text-zinc-300 leading-relaxed">{source.description}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-3 text-xs font-medium text-zinc-500">Actions</div>
        {isActing ? (
          <span className="text-sm text-zinc-500">Working…</span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {source.status !== "approved" && (
              <button
                onClick={() => reviewAction("approve")}
                className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors"
              >
                Approve
              </button>
            )}
            {source.status !== "parked" && (
              <button
                onClick={() => reviewAction("parked")}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Park
              </button>
            )}
            {source.status !== "rejected" && (
              <button
                onClick={() => reviewAction("reject")}
                className="rounded border border-red-800 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/30 transition-colors"
              >
                Reject
              </button>
            )}
            {source.status !== "rejected" && (
              <button
                onClick={blacklistAction}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 hover:text-red-400 hover:border-red-800 transition-colors"
              >
                Blacklist & Reject
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-3 text-xs font-medium text-zinc-500">
          Tags
          {source.tags.length > 0 && (
            <span className="ml-1 text-zinc-600">({source.tags.length})</span>
          )}
        </div>

        {/* Current tags */}
        {source.tags.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {source.tags.map((tag) => (
              <span
                key={tag.id}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${facetColor(tag.facet)}`}
              >
                <span className="text-[10px] uppercase tracking-wide opacity-60">
                  {tag.facet}
                </span>
                {tag.name}
                <button
                  onClick={() => removeTag(tag.id)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-black/20 transition-colors"
                  title={`Remove ${tag.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="mb-4 text-sm text-zinc-600">No tags assigned.</p>
        )}

        {/* Add tag */}
        <div className="flex flex-wrap items-center gap-2">
          {tagsLoading ? (
            <span className="text-xs text-zinc-500">Loading tags…</span>
          ) : availableTags.length > 0 ? (
            <>
              <select
                value={addTagSelect}
                onChange={(e) => setAddTagSelect(e.target.value)}
                className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-zinc-500 min-w-[200px]"
              >
                <option value="">Add a tag…</option>
                {sortedFacets.map((facet) => {
                  const facetTags = (tagsByFacet.get(facet) ?? []).sort(
                    (a, b) => a.name.localeCompare(b.name)
                  );
                  return (
                    <optgroup key={facet} label={facet}>
                      {facetTags.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              <button
                onClick={addTag}
                disabled={!addTagSelect || addingTag}
                className="rounded bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-zinc-200 transition-colors disabled:opacity-40"
              >
                {addingTag ? "Adding…" : "Add"}
              </button>
            </>
          ) : (
            <span className="text-xs text-zinc-600">All available tags are already assigned.</span>
          )}
        </div>
      </div>
    </div>
  );
}
