"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────

interface AdminSource {
  id: string;
  title: string;
  site_url: string;
  feed_url: string;
  hidden: boolean;
  last_fetched_at: string | null;
  articles: { count: number }[];
}

interface AdminTag {
  id: string;
  name: string;
  slug: string;
  facet: string;
  parent_id: string | null;
  display_order: number | null;
  article_tags: { count: number }[];
}

type Tab = "sources" | "tags";

// ── Helpers ────────────────────────────────────────

function count(arr: { count: number }[] | undefined | null): number {
  return arr?.[0]?.count ?? 0;
}

// ── Page ───────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("sources");

  // Sources state
  const [sources, setSources] = useState<AdminSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [showHiddenOnly, setShowHiddenOnly] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Tags state
  const [tags, setTags] = useState<AdminTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "", facet: "" });
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch Sources ──────────────────────────────────

  const fetchSources = useCallback(async () => {
    setSourcesLoading(true);
    try {
      const res = await fetch("/api/admin/sources");
      if (!res.ok) throw new Error("Failed to fetch sources");
      const data = await res.json();
      setSources(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSourcesLoading(false);
    }
  }, []);

  // ── Fetch Tags ─────────────────────────────────────

  const fetchTags = useCallback(async () => {
    setTagsLoading(true);
    try {
      const res = await fetch("/api/admin/tags");
      if (!res.ok) throw new Error("Failed to fetch tags");
      const data = await res.json();
      setTags(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTagsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
    fetchTags();
  }, [fetchSources, fetchTags]);

  // ── Toggle hidden ──────────────────────────────────

  const toggleHidden = async (source: AdminSource) => {
    setTogglingId(source.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: !source.hidden }),
      });
      if (!res.ok) throw new Error("Failed to update");
      await fetchSources();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTogglingId(null);
    }
  };

  // ── Tag edit ───────────────────────────────────────

  const startEdit = (tag: AdminTag) => {
    setEditingId(tag.id);
    setEditForm({ name: tag.name, slug: tag.slug, facet: tag.facet });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: "", slug: "", facet: "" });
  };

  const saveEdit = async (tagId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/tags/${tagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update tag");
      }
      cancelEdit();
      await fetchTags();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Tag merge ──────────────────────────────────────

  const startMerge = (tagId: string) => {
    setMergeSourceId(tagId);
    setMergeTargetId("");
  };

  const cancelMerge = () => {
    setMergeSourceId(null);
    setMergeTargetId("");
  };

  const confirmMerge = async () => {
    if (!mergeSourceId || !mergeTargetId) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/tags/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: mergeSourceId, targetId: mergeTargetId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Merge failed");
      }
      cancelMerge();
      await fetchTags();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Tag delete ─────────────────────────────────────

  const confirmDelete = async (tagId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/tags/${tagId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      setDeletingId(null);
      await fetchTags();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Filtered sources ───────────────────────────────

  const displayedSources = showHiddenOnly
    ? sources.filter((s) => s.hidden)
    : sources;

  // ── Render ──────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-100">Admin</h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1 w-fit">
        <button
          onClick={() => setTab("sources")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "sources"
              ? "bg-white text-black"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Sources
        </button>
        <button
          onClick={() => setTab("tags")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "tags"
              ? "bg-white text-black"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Tags
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">Dismiss</button>
        </div>
      )}

      {/* ── Sources Tab ──────────────────────────────── */}
      {tab === "sources" && (
        <div>
          {/* Show hidden toggle */}
          <label className="mb-4 flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showHiddenOnly}
              onChange={(e) => setShowHiddenOnly(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-800 accent-white"
            />
            Show hidden only
          </label>

          {sourcesLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900 text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Site</th>
                    <th className="px-4 py-3 text-center font-medium">Articles</th>
                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Last fetched</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {displayedSources.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="px-4 py-3 text-zinc-100 max-w-[200px] truncate" title={s.title}>
                        {s.title}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 hidden sm:table-cell max-w-[200px] truncate">
                        <a
                          href={s.site_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-zinc-200 transition-colors"
                        >
                          {s.site_url}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-400">
                        {count(s.articles)}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 hidden md:table-cell text-xs">
                        {s.last_fetched_at
                          ? new Date(s.last_fetched_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleHidden(s)}
                          disabled={togglingId === s.id}
                          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                            s.hidden
                              ? "bg-red-900/40 text-red-300 border border-red-800 hover:bg-red-900/60"
                              : "bg-emerald-900/30 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/50"
                          } disabled:opacity-50`}
                        >
                          {togglingId === s.id ? "…" : s.hidden ? "Show" : "Hide"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {displayedSources.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                        No sources found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tags Tab ──────────────────────────────────── */}
      {tab === "tags" && (
        <div>
          {tagsLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900 text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Slug</th>
                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Facet</th>
                    <th className="px-4 py-3 text-center font-medium">Articles</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {tags.map((t) => (
                    <tr
                      key={t.id}
                      className={`hover:bg-zinc-900/50 transition-colors ${
                        mergeSourceId === t.id ? "bg-zinc-800" : ""
                      }`}
                    >
                      {/* Name */}
                      <td className="px-4 py-3 text-zinc-100">
                        {editingId === t.id ? (
                          <input
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, name: e.target.value }))
                            }
                            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                          />
                        ) : (
                          <span className="max-w-[150px] truncate block">{t.name}</span>
                        )}
                      </td>

                      {/* Slug */}
                      <td className="px-4 py-3 text-zinc-400 hidden sm:table-cell">
                        {editingId === t.id ? (
                          <input
                            value={editForm.slug}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, slug: e.target.value }))
                            }
                            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                          />
                        ) : (
                          <code className="text-xs">{t.slug}</code>
                        )}
                      </td>

                      {/* Facet */}
                      <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">
                        {editingId === t.id ? (
                          <input
                            value={editForm.facet}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, facet: e.target.value }))
                            }
                            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                          />
                        ) : (
                          <span className="text-xs">{t.facet}</span>
                        )}
                      </td>

                      {/* Article count */}
                      <td className="px-4 py-3 text-center text-zinc-400">
                        {count(t.article_tags)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {editingId === t.id ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => saveEdit(t.id)}
                              className="rounded bg-white px-2.5 py-1 text-xs font-medium text-black hover:bg-zinc-200 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : mergeSourceId === t.id ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <select
                              value={mergeTargetId}
                              onChange={(e) => setMergeTargetId(e.target.value)}
                              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none"
                            >
                              <option value="">Select target…</option>
                              {tags
                                .filter((o) => o.id !== t.id)
                                .map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.name} ({o.slug})
                                  </option>
                                ))}
                            </select>
                            <button
                              onClick={confirmMerge}
                              disabled={!mergeTargetId}
                              className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-40"
                            >
                              Merge
                            </button>
                            <button
                              onClick={cancelMerge}
                              className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : deletingId === t.id ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-xs text-red-400">
                              Delete &quot;{t.name}&quot;?
                            </span>
                            <button
                              onClick={() => confirmDelete(t.id)}
                              className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500 transition-colors"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => startEdit(t)}
                              className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => startMerge(t.id)}
                              className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                            >
                              Merge
                            </button>
                            <button
                              onClick={() => setDeletingId(t.id)}
                              className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-red-400 hover:border-red-800 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {tags.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                        No tags found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
