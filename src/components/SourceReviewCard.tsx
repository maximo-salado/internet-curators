"use client";

import { useState, useEffect } from "react";
import { TagSelector } from "./TagSelector";

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
  independence_signals: {
    self_hosted?: boolean;
    custom_domain?: boolean;
    has_trackers?: boolean;
    // Trust signals — verified membership (emerald green)
    content_credentials?: boolean;
    trust_project?: boolean;
    jti_certified?: boolean;
    ifcn_signatory?: boolean;
    // Trust signals — values alignment (amber)
    creative_commons?: string;
    not_by_ai?: boolean;
    indieweb?: boolean;
    // Research aid (link, not badge)
    editorial_standards_url?: string;
    // Metadata
    _enrichment_failed?: boolean;
    _enrichment_attempted?: boolean;
    // Manual override tracking
    _manual_overrides?: Record<string, boolean>;
  };
  status: string;
  discovered_at: string;
}

interface Props {
  source: DiscoveredSource;
  isEditor: boolean;
  onTransition: (id: string, to: string) => void;
  onSignalsUpdated?: (sourceId: string, signals: Record<string, unknown>) => void;
}

const platformColors: Record<string, string> = {
  substack: "bg-orange-900/50 text-orange-300",
  ghost: "bg-blue-900/50 text-blue-300",
  wordpress: "bg-sky-900/50 text-sky-300",
  bearblog: "bg-amber-900/50 text-amber-300",
  mastodon: "bg-purple-900/50 text-purple-300",
  lemmy: "bg-green-900/50 text-green-300",
  microblog: "bg-pink-900/50 text-pink-300",
  neocities: "bg-red-900/50 text-red-300",
  tumblr: "bg-indigo-900/50 text-indigo-300",
  medium: "bg-zinc-800 text-zinc-400",
  blogger: "bg-yellow-900/50 text-yellow-300",
};

function normalizeCCLicense(raw: string): string {
  if (raw === "licensed") return "CC licensed";
  const [type, version] = raw.split("/");
  const formatted = type.split("-").map((p) => p.toUpperCase()).join("-");
  return version ? `CC ${formatted} ${version}` : `CC ${formatted}`;
}

export function SourceReviewCard({ source, isEditor, onTransition, onSignalsUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const sig = source.independence_signals;

  // --- Trust signal override state ---
  const [editingTrust, setEditingTrust] = useState(false);
  const [trustOverrides, setTrustOverrides] = useState<Record<string, boolean>>({});
  const [overrideUrls, setOverrideUrls] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const isManual = (key: string) => {
    const overrides = (sig as any)?._manual_overrides ?? {};
    return overrides[key] === true;
  };

  const effectiveValue = (key: string) => {
    if (key in trustOverrides) return trustOverrides[key];
    return (sig as any)?.[key] ?? false;
  };

  const DRAFT_KEY = `ic:source-tags:${source.id}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setSelectedTagIds(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data) => setAllTags(data.tags ?? []))
      .catch(() => {});
  }, []);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      prev.has(tagId) ? next.delete(tagId) : next.add(tagId);
      return next;
    });
    // Write to localStorage after state update (not inside the updater — must be pure)
    const next = new Set(selectedTagIds);
    next.has(tagId) ? next.delete(tagId) : next.add(tagId);
    localStorage.setItem(DRAFT_KEY, JSON.stringify([...next]));
  };

  const handleAction = async (action: "approve" | "reject" | "pending" | "parked") => {
    if (loading || !isEditor) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/discover/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "approve" ? { tag_ids: [...selectedTagIds] } : {}),
        }),
      });
      if (!res.ok) return;
      if (action === "approve" || action === "reject" || action === "parked") {
        localStorage.removeItem(DRAFT_KEY);
      }
      onTransition(source.id, action);
    } catch {
      // Network error — user can retry
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="rounded-xl bg-zinc-900 px-4 py-5">
      {/* Badge row */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {source.platform && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${platformColors[source.platform] ?? "bg-zinc-800 text-zinc-400"}`}>
            {source.platform}
          </span>
        )}
        {source.language && (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
            {source.language.toUpperCase()}
          </span>
        )}
        {sig?.self_hosted && (
          <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-[11px] font-medium text-green-300">
            self-hosted
          </span>
        )}
        {sig?.custom_domain && (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
            custom domain
          </span>
        )}
        {sig?.has_trackers && (
          <span className="rounded-full bg-yellow-900/50 px-2 py-0.5 text-[11px] font-medium text-yellow-300">
            trackers
          </span>
        )}

        {/* Verified membership */}
        {sig?.content_credentials && (
          <span
            title="Content Credentials verified"
            className={`rounded-full bg-emerald-900/40 px-2 py-0.5 text-[11px] font-medium text-emerald-300${sig._manual_overrides?.content_credentials ? " border border-dashed border-emerald-600" : ""}`}
          >
            content credentials
          </span>
        )}
        {sig?.trust_project && (
          <span
            title="Trust Project member"
            className={`rounded-full bg-emerald-900/40 px-2 py-0.5 text-[11px] font-medium text-emerald-300${sig._manual_overrides?.trust_project ? " border border-dashed border-emerald-600" : ""}`}
          >
            trust project
          </span>
        )}
        {sig?.jti_certified && (
          <span
            title="JTI certified"
            className={`rounded-full bg-emerald-900/40 px-2 py-0.5 text-[11px] font-medium text-emerald-300${sig._manual_overrides?.jti_certified ? " border border-dashed border-emerald-600" : ""}`}
          >
            jti certified
          </span>
        )}
        {sig?.ifcn_signatory && (
          <span
            title="IFCN signatory"
            className={`rounded-full bg-emerald-900/40 px-2 py-0.5 text-[11px] font-medium text-emerald-300${sig._manual_overrides?.ifcn_signatory ? " border border-dashed border-emerald-600" : ""}`}
          >
            ifcn signatory
          </span>
        )}

        {/* Values alignment */}
        {sig?.creative_commons && (
          <span
            title="Creative Commons licensed"
            className={`rounded-full bg-amber-900/40 px-2 py-0.5 text-[11px] font-medium text-amber-300${sig._manual_overrides?.creative_commons ? " border border-dashed border-amber-600" : ""}`}
          >
            {typeof sig.creative_commons === "string" ? normalizeCCLicense(sig.creative_commons) : "CC licensed"}
          </span>
        )}
        {sig?.not_by_ai && (
          <span
            title="Not By AI pledge"
            className={`rounded-full bg-amber-900/40 px-2 py-0.5 text-[11px] font-medium text-amber-300${sig._manual_overrides?.not_by_ai ? " border border-dashed border-amber-600" : ""}`}
          >
            not by ai
          </span>
        )}
        {sig?.indieweb && (
          <span
            title="IndieWeb participant"
            className={`rounded-full bg-amber-900/40 px-2 py-0.5 text-[11px] font-medium text-amber-300${sig._manual_overrides?.indieweb ? " border border-dashed border-amber-600" : ""}`}
          >
            indieweb
          </span>
        )}

        {/* Research aid */}
        {sig?.editorial_standards_url && (() => {
          const rawUrl = sig.editorial_standards_url;
          const resolved = rawUrl.startsWith("http")
            ? rawUrl
            : (rawUrl.startsWith("/") || rawUrl.startsWith("."))
              ? (() => { try { return new URL(rawUrl, source.site_url).href; } catch { return null; } })()
              : null;
          if (!resolved || !/^https?:\/\//.test(resolved)) return null;
          return (
            <a
              href={resolved}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2 ml-1"
            >
              → standards
            </a>
          );
        })()}

        {/* Enrichment failure */}
        {sig?._enrichment_failed && (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
            ⚠ unchecked
          </span>
        )}

        {/* Edit trust signals toggle */}
        {isEditor && (
          <button
            onClick={() => setEditingTrust(!editingTrust)}
            className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors ml-1"
            title="Edit trust signals"
          >
            ✎
          </button>
        )}
      </div>

      {/* Inline trust signal editor */}
      {editingTrust && (
        <div className="mt-2 border border-zinc-700 rounded-lg bg-zinc-800/50 p-3">
          <p className="text-[10px] text-emerald-400 uppercase tracking-wider mb-2">Verified Membership</p>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {([
              { key: "content_credentials", label: "Content Credentials" },
              { key: "trust_project", label: "Trust Project" },
              { key: "jti_certified", label: "JTI Certified" },
              { key: "ifcn_signatory", label: "IFCN Signatory" },
            ] as const).map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-0.5">
                <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effectiveValue(key)}
                    onChange={(e) => setTrustOverrides((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="rounded border-zinc-600 bg-zinc-700"
                  />
                  {label}
                  {isManual(key) && <span className="text-[9px] text-zinc-600">manual</span>}
                </label>
                {effectiveValue(key) && !(sig as any)?.[key] && (
                  <input
                    type="url"
                    placeholder="Paste evidence URL..."
                    value={overrideUrls[key] ?? ""}
                    onChange={(e) => setOverrideUrls((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="ml-5 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 placeholder:text-zinc-600"
                  />
                )}
              </div>
            ))}
          </div>

          <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-2">Values Alignment</p>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {([
              { key: "creative_commons", label: "Creative Commons" },
              { key: "not_by_ai", label: "Not by AI" },
              { key: "indieweb", label: "IndieWeb" },
            ] as const).map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={effectiveValue(key)}
                  onChange={(e) => setTrustOverrides((prev) => ({ ...prev, [key]: e.target.checked }))}
                  className="rounded border-zinc-600 bg-zinc-700"
                />
                {label}
                {isManual(key) && <span className="text-[9px] text-zinc-600">manual</span>}
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`/api/discover/sources/${source.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "update_trust_signals",
                      trust_overrides: trustOverrides,
                      override_urls: overrideUrls,
                    }),
                  });
                  const data = await res.json();
                  if (data.success && data.signals) {
                    onSignalsUpdated?.(source.id, data.signals);
                    setTrustOverrides({});
                    setOverrideUrls({});
                    setSaveError(null);
                    setEditingTrust(false);
                  } else {
                    setSaveError(data.error || "Save failed");
                  }
                } catch {
                  setSaveError("Network error — try again");
                }
              }}
              className="rounded bg-emerald-800 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-700"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditingTrust(false);
                setTrustOverrides({});
                setOverrideUrls({});
                setSaveError(null);
              }}
              className="rounded bg-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-600"
            >
              Cancel
            </button>
          </div>
          {saveError && (
            <p className="mt-2 text-[10px] text-red-400">{saveError}</p>
          )}
        </div>
      )}

      {/* Title */}
      <a
        href={source.site_url || source.feed_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <h2 className="font-semibold text-zinc-100 leading-snug hover:underline">
          {source.title}
        </h2>
      </a>

      {/* Description */}
      {source.description && (
        <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{source.description}</p>
      )}

      {/* Recent posts */}
      {source.recent_posts && source.recent_posts.length > 0 && (
        <div className="mt-2 border-t border-zinc-800 pt-2">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Recent posts</p>
          <ul className="space-y-0.5">
            {source.recent_posts.slice(0, 3).map((post, i) => (
              <li key={i} className="text-xs text-zinc-400 truncate">
                · {post.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested tags */}
      {source.suggested_tags && source.suggested_tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {source.suggested_tags.map((tag) => (
            <span key={tag} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Topic + Stance + Format tags (editor-assignable. Voice is article-level, keyword-matched) */}
      {isEditor && allTags.length > 0 && (
        <div className="mt-2 border-t border-zinc-800 pt-2">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Assign Tags</p>
          <TagSelector
            allTags={allTags}
            selectedTagIds={selectedTagIds}
            onToggle={toggleTag}
            facets={["topic", "stance", "format"]}
          />
        </div>
      )}

      {/* Actions — context-aware per status */}
      {isEditor && (
        <div className="mt-3 flex gap-2 border-t border-zinc-800 pt-3">
          {source.status === "pending" && (
            <>
              <button onClick={() => handleAction("approve")} disabled={loading}
                className="flex-1 rounded-lg bg-green-900/30 border border-green-800 px-3 py-2 text-sm font-medium text-green-400 hover:bg-green-900/50 transition-colors disabled:opacity-50">
                ✓ Approve
              </button>
              <button onClick={() => handleAction("reject")} disabled={loading}
                className="flex-1 rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-900/50 transition-colors disabled:opacity-50">
                ✗ Reject
              </button>
              <button onClick={() => handleAction("parked")} disabled={loading}
                className="rounded-lg bg-amber-900/30 border border-amber-800 px-3 py-2 text-sm font-medium text-amber-400 hover:bg-amber-900/50 transition-colors disabled:opacity-50">
                ⏸ Park
              </button>
            </>
          )}
          {source.status === "approved" && (
            <>
              <span className="text-xs font-medium text-green-400 self-center mr-auto">✓ Approved</span>
              <button onClick={() => handleAction("pending")} disabled={loading}
                className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-700 transition-colors disabled:opacity-50">
                ↩ Pending
              </button>
              <button onClick={() => handleAction("reject")} disabled={loading}
                className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-900/50 transition-colors disabled:opacity-50">
                ✗ Reject
              </button>
              <button onClick={() => handleAction("parked")} disabled={loading}
                className="rounded-lg bg-amber-900/30 border border-amber-800 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-amber-900/50 transition-colors disabled:opacity-50">
                ⏸ Park
              </button>
            </>
          )}
          {source.status === "rejected" && (
            <>
              <span className="text-xs font-medium text-red-400 self-center mr-auto">✗ Rejected</span>
              <button onClick={() => handleAction("pending")} disabled={loading}
                className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-700 transition-colors disabled:opacity-50">
                ↩ Pending
              </button>
              <button onClick={() => handleAction("approve")} disabled={loading}
                className="rounded-lg bg-green-900/30 border border-green-800 px-3 py-2 text-xs font-medium text-green-400 hover:bg-green-900/50 transition-colors disabled:opacity-50">
                ✓ Approve
              </button>
              <button onClick={() => handleAction("parked")} disabled={loading}
                className="rounded-lg bg-amber-900/30 border border-amber-800 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-amber-900/50 transition-colors disabled:opacity-50">
                ⏸ Park
              </button>
            </>
          )}
          {source.status === "parked" && (
            <>
              <span className="text-xs font-medium text-amber-400 self-center mr-auto">⏸ Parked</span>
              <button onClick={() => handleAction("pending")} disabled={loading}
                className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-700 transition-colors disabled:opacity-50">
                ↩ Pending
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
