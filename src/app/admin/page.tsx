"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────

interface AdminTag {
  id: string;
  name: string;
  slug: string;
  facet: string;
  parent_id: string | null;
  display_order: number | null;
  article_tags: { count: number }[];
}

type Tab = "sources" | "tags" | "issue";

// Discovered source from the review queue
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
  tags: { slug: string; name: string; facet: string }[];
}

// Issue article
interface IssueArticle {
  articleId: string;
  position: number;
  title: string;
  link: string;
  image: string | null;
  contentSnippet: string;
  pubDate: string | null;
  sourceId: string;
  sourceTitle: string;
}

// Pool article for adding to issue
interface PoolArticle {
  articleId: string;
  title: string;
  link: string;
  image: string | null;
  contentSnippet: string;
  pubDate: string | null;
  sourceId: string;
  sourceTitle: string;
}

interface IssueData {
  id: string;
  issue_number: number;
  date: string;
  origin: string;
  published: boolean;
}

// ── Helpers ────────────────────────────────────────

function count(arr: { count: number }[] | undefined | null): number {
  return arr?.[0]?.count ?? 0;
}

// ── Page ───────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("sources");

  // Tags state
  const [tags, setTags] = useState<AdminTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "", facet: "" });
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Review state
  const [discoveredSources, setDiscoveredSources] = useState<DiscoveredSource[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>("all");
  const [actingId, setActingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [blacklistingId, setBlacklistingId] = useState<string | null>(null);

  // Issue state
  const [issueLoading, setIssueLoading] = useState(false);
  const [issue, setIssue] = useState<IssueData | null>(null);
  const [issueArticles, setIssueArticles] = useState<IssueArticle[]>([]);
  const [issueError, setIssueError] = useState<string | null>(null);

  // Add article modal
  const [showPoolModal, setShowPoolModal] = useState(false);
  const [poolArticles, setPoolArticles] = useState<PoolArticle[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolQuery, setPoolQuery] = useState("");
  const [poolTotal, setPoolTotal] = useState(0);
  const [addingArticleId, setAddingArticleId] = useState<string | null>(null);

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

  // ── Fetch Review Queue ───────────────────────────

  const fetchDiscoveredSources = useCallback(async (status?: string) => {
    setReviewLoading(true);
    setReviewError(null);
    const s = status ?? reviewStatusFilter;
    try {
      const res = await fetch(`/api/discover/sources?status=${s}&limit=50`);
      if (!res.ok) throw new Error("Failed to fetch discovered sources");
      const data = await res.json();
      setDiscoveredSources(data.items ?? []);
    } catch (e: any) {
      setReviewError(e.message);
    } finally {
      setReviewLoading(false);
    }
  }, [reviewStatusFilter]);

  useEffect(() => {
    if (tab === "sources") {
      fetchDiscoveredSources();
    }
  }, [tab, reviewStatusFilter, fetchDiscoveredSources]);

  const handleStatusFilter = (status: string) => {
    setReviewStatusFilter(status);
  };

  // ── Review Actions ──────────────────────────────

  const reviewAction = async (source: DiscoveredSource, action: "approve" | "reject" | "parked") => {
    setActingId(source.id);
    setReviewError(null);
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
      await fetchDiscoveredSources();
    } catch (e: any) {
      setReviewError(e.message);
    } finally {
      setActingId(null);
    }
  };

  const blacklistSource = async (source: DiscoveredSource) => {
    setBlacklistingId(source.id);
    setReviewError(null);
    try {
      // First blacklist the feed
      const blRes = await fetch("/api/admin/blacklisted-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feed_url: source.feed_url }),
      });
      if (!blRes.ok) {
        const data = await blRes.json();
        throw new Error(data.error || "Blacklist failed");
      }
      // Then reject it
      await reviewAction(source, "reject");
    } catch (e: any) {
      setReviewError(e.message);
    } finally {
      setBlacklistingId(null);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

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

  // ── Issue Fetching ──────────────────────────────────

  const fetchIssue = useCallback(async () => {
    setIssueLoading(true);
    setIssueError(null);
    try {
      const res = await fetch("/api/admin/issue");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch issue");
      }
      const data = await res.json();
      setIssue(data.issue ?? null);
      setIssueArticles(data.articles ?? []);
    } catch (e: any) {
      setIssueError(e.message);
    } finally {
      setIssueLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "issue") {
      fetchIssue();
    }
  }, [tab, fetchIssue]);

  // ── Pool Fetching ───────────────────────────────────

  const fetchPool = useCallback(async (query: string = "") => {
    setPoolLoading(true);
    try {
      const res = await fetch(`/api/admin/issue/pool?q=${encodeURIComponent(query)}&limit=50`);
      if (!res.ok) throw new Error("Failed to fetch pool");
      const data = await res.json();
      setPoolArticles(data.articles ?? []);
      setPoolTotal(data.total ?? 0);
    } catch (e: any) {
      setIssueError(e.message);
    } finally {
      setPoolLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showPoolModal) {
      fetchPool(poolQuery);
    }
  }, [showPoolModal, poolQuery, fetchPool]);

  // ── Issue Actions ───────────────────────────────────

  const removeArticle = async (articleId: string) => {
    setIssueError(null);
    try {
      const res = await fetch("/api/admin/issue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", articleId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Remove failed");
      }
      const data = await res.json();
      setIssue(data.issue);
      setIssueArticles(data.articles);
    } catch (e: any) {
      setIssueError(e.message);
    }
  };

  const addArticle = async (articleId: string) => {
    setAddingArticleId(articleId);
    setIssueError(null);
    try {
      const res = await fetch("/api/admin/issue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", articleId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Add failed");
      }
      const data = await res.json();
      setIssue(data.issue);
      setIssueArticles(data.articles);
      // Refresh pool after adding
      fetchPool(poolQuery);
    } catch (e: any) {
      setIssueError(e.message);
    } finally {
      setAddingArticleId(null);
    }
  };

  const moveArticle = async (articleId: string, direction: "up" | "down") => {
    const idx = issueArticles.findIndex((a) => a.articleId === articleId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === issueArticles.length - 1) return;

    const newOrder = [...issueArticles];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

    setIssueError(null);
    try {
      const res = await fetch("/api/admin/issue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder",
          articleIds: newOrder.map((a) => a.articleId),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Reorder failed");
      }
      const data = await res.json();
      setIssue(data.issue);
      setIssueArticles(data.articles);
    } catch (e: any) {
      setIssueError(e.message);
    }
  };

  const togglePublish = async () => {
    if (!issue) return;
    setIssueError(null);
    try {
      const res = await fetch("/api/admin/issue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Publish failed");
      }
      const data = await res.json();
      setIssue(data.issue);
    } catch (e: any) {
      setIssueError(e.message);
    }
  };

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
        <button
          onClick={() => setTab("issue")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "issue"
              ? "bg-white text-black"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Issue
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">Dismiss</button>
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
      {/* ── Sources Tab (Review) ────────────────────── */}
      {tab === "sources" && (
        <div>
          {reviewError && (
            <div className="mb-4 rounded-md border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
              {reviewError}
              <button onClick={() => setReviewError(null)} className="ml-3 underline">Dismiss</button>
            </div>
          )}

          {/* Status filter */}
          <div className="mb-4 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1 w-fit">
            {(["all", "pending", "approved", "rejected", "parked"] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleStatusFilter(s)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                  reviewStatusFilter === s
                    ? "bg-white text-black"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {reviewLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900 text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Feed</th>
                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Discovered</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {discoveredSources.map((s) => {
                    const isActing = actingId === s.id;
                    const isBlacklisting = blacklistingId === s.id;
                    return (
                      <tr key={s.id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="px-4 py-3 text-zinc-100 max-w-[200px] truncate" title={s.title}>
                          <div>{s.title}</div>
                          {s.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {s.tags.map((t) => (
                                <span
                                  key={t.slug}
                                  className="inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
                                >
                                  {t.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 hidden sm:table-cell max-w-[200px] truncate">
                          <a
                            href={s.site_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-zinc-200 transition-colors"
                          >
                            {s.feed_url}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-zinc-500 hidden md:table-cell text-xs">
                          {new Date(s.discovered_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              s.status === "pending"
                                ? "bg-yellow-900/40 text-yellow-300 border border-yellow-800"
                                : s.status === "approved"
                                ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800"
                                : s.status === "rejected"
                                ? "bg-red-900/40 text-red-300 border border-red-800"
                                : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isBlacklisting ? (
                            <span className="text-xs text-zinc-500">Blacklisting…</span>
                          ) : isActing ? (
                            <span className="text-xs text-zinc-500">Working…</span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {s.status !== "approved" && (
                                <button
                                  onClick={() => reviewAction(s, "approve")}
                                  className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 transition-colors"
                                >
                                  Approve
                                </button>
                              )}
                              {s.status !== "parked" && (
                                <button
                                  onClick={() => reviewAction(s, "parked")}
                                  className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                                >
                                  Park
                                </button>
                              )}
                              {s.status !== "rejected" && (
                                <button
                                  onClick={() => reviewAction(s, "reject")}
                                  className="rounded border border-red-800 px-2.5 py-1 text-xs text-red-400 hover:bg-red-900/30 transition-colors"
                                >
                                  Reject
                                </button>
                              )}
                              {s.status !== "rejected" && (
                                <button
                                  onClick={() => blacklistSource(s)}
                                  className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-500 hover:text-red-400 hover:border-red-800 transition-colors"
                                >
                                  Blacklist
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {discoveredSources.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                        No discovered sources found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Issue Tab ──────────────────────────────────── */}
      {tab === "issue" && (
        <div>
          {issueError && (
            <div className="mb-4 rounded-md border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
              {issueError}
              <button onClick={() => setIssueError(null)} className="ml-3 underline">Dismiss</button>
            </div>
          )}

          {issueLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : !issue ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <p className="text-zinc-400 text-sm">
                Issue not yet created. It will be generated at midnight.
              </p>
            </div>
          ) : (
            <div>
              {/* Issue header */}
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">
                    Issue #{issue.issue_number}
                  </h2>
                  <p className="text-sm text-zinc-400">
                    {new Date(issue.date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                    {" · "}
                    <span className={issue.origin === "curated" ? "text-blue-400" : "text-zinc-500"}>
                      {issue.origin === "curated" ? "Curated" : "Auto-generated"}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePublish}
                    className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                      issue.published
                        ? "bg-emerald-900/30 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/50"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700"
                    }`}
                  >
                    {issue.published ? "Published" : "Draft"}
                  </button>
                  <button
                    onClick={() => { setShowPoolModal(true); fetchPool(""); }}
                    className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 transition-colors"
                  >
                    + Add Article
                  </button>
                </div>
              </div>

              {/* Article list */}
              {issueArticles.length === 0 ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
                  <p className="text-zinc-400 text-sm">No articles in this issue yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900 text-zinc-400">
                      <tr>
                        <th className="px-4 py-3 text-center font-medium w-12">#</th>
                        <th className="px-4 py-3 text-left font-medium">Article</th>
                        <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Source</th>
                        <th className="px-4 py-3 text-right font-medium w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {issueArticles.map((a, idx) => (
                        <tr key={a.articleId} className="hover:bg-zinc-900/50 transition-colors">
                          <td className="px-4 py-3 text-center text-zinc-500 text-xs">
                            {a.position + 1}
                          </td>
                          <td className="px-4 py-3 text-zinc-100 max-w-[300px] truncate" title={a.title}>
                            <a
                              href={a.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-400 transition-colors"
                            >
                              {a.title}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-zinc-400 hidden sm:table-cell">
                            {a.sourceTitle}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => moveArticle(a.articleId, "up")}
                                disabled={idx === 0}
                                className="rounded border border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Move up"
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => moveArticle(a.articleId, "down")}
                                disabled={idx === issueArticles.length - 1}
                                className="rounded border border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Move down"
                              >
                                ▼
                              </button>
                              <button
                                onClick={() => removeArticle(a.articleId)}
                                className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/30 hover:border-red-800 transition-colors ml-1"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Add Article Modal ─────────────────────────── */}
      {showPoolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <h3 className="text-lg font-semibold text-zinc-100">Add Article from Pool</h3>
              <button
                onClick={() => setShowPoolModal(false)}
                className="text-zinc-400 hover:text-zinc-200 transition-colors text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Search */}
            <div className="px-6 py-3 border-b border-zinc-800">
              <input
                type="text"
                placeholder="Search articles…"
                value={poolQuery}
                onChange={(e) => setPoolQuery(e.target.value)}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 placeholder:text-zinc-500"
              />
              {poolTotal > 0 && (
                <p className="mt-1 text-xs text-zinc-500">{poolTotal} eligible articles</p>
              )}
            </div>

            {/* Article list */}
            <div className="flex-1 overflow-y-auto px-6 py-2">
              {poolLoading ? (
                <p className="text-sm text-zinc-500 py-4">Loading…</p>
              ) : poolArticles.length === 0 ? (
                <p className="text-sm text-zinc-500 py-4">No eligible articles found.</p>
              ) : (
                <div className="space-y-1 py-2">
                  {poolArticles.map((a) => {
                    const isAdding = addingArticleId === a.articleId;
                    const alreadyInIssue = issueArticles.some(
                      (ia) => ia.articleId === a.articleId
                    );
                    return (
                      <div
                        key={a.articleId}
                        className="flex items-start justify-between gap-3 rounded-md px-3 py-2.5 hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-100 truncate">{a.title}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">{a.sourceTitle}</p>
                        </div>
                        <button
                          onClick={() => addArticle(a.articleId)}
                          disabled={isAdding || alreadyInIssue}
                          className="shrink-0 rounded bg-white px-3 py-1 text-xs font-medium text-black hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {alreadyInIssue ? "Added" : isAdding ? "Adding…" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="border-t border-zinc-800 px-6 py-3 flex justify-end">
              <button
                onClick={() => setShowPoolModal(false)}
                className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
