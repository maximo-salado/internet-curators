"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface Source {
  id: string;
  feed_url: string;
  title: string;
  site_url: string;
  description: string;
  created_at: string;
}

interface Collection {
  id: string;
  name: string;
  description: string;
  slug: string;
  published: boolean;
  sources: Source[];
}

export default function CollectionDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedUrl, setFeedUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const fetchCollection = useCallback(async () => {
    const res = await fetch(`/api/collections/${slug}`);
    if (res.ok) setCollection(await res.json());
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    if (!feedUrl.trim()) return;
    setAdding(true);
    setError("");
    const res = await fetch(`/api/collections/${slug}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feed_url: feedUrl.trim() }),
    });
    if (res.ok) {
      setFeedUrl("");
      fetchCollection();
    } else {
      const { error: msg } = await res.json();
      setError(msg || "Failed to add source");
    }
    setAdding(false);
  }

  async function removeSource(id: string) {
    const res = await fetch(`/api/sources/${id}`, { method: "DELETE" });
    if (res.ok) fetchCollection();
  }

  async function togglePublished() {
    if (!collection) return;
    const res = await fetch("/api/collections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: collection.id, published: !collection.published }),
    });
    if (res.ok) fetchCollection();
  }

  if (loading) return <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12"><p className="text-sm text-zinc-500">Loading...</p></main>;
  if (!collection) return <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12"><p className="text-zinc-400">Collection not found.</p></main>;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link href="/dashboard" className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-300">← Back to Dashboard</Link>

      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{collection.name}</h1>
            {collection.description && <p className="mt-2 text-zinc-400">{collection.description}</p>}
            <p className="mt-1 text-xs text-zinc-600">/{collection.slug}</p>
          </div>
          <button
            onClick={togglePublished}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              collection.published
                ? "bg-green-900 text-green-400 hover:bg-green-800"
                : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
            }`}
          >
            {collection.published ? "Published" : "Draft"}
          </button>
        </div>
      </div>

      {/* Add source form */}
      <form onSubmit={addSource} className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-sm font-medium text-zinc-300">Add RSS Source</h2>
        <div className="flex gap-3">
          <input
            type="url"
            placeholder="https://example.com/feed.xml"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            required
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={adding}
            className="rounded-md bg-white px-5 py-3 text-sm font-medium text-black hover:bg-zinc-200 transition-colors disabled:opacity-50 shrink-0"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </form>

      {/* Sources list */}
      <h2 className="mb-4 text-sm font-medium text-zinc-300">
        Sources ({collection.sources?.length ?? 0})
      </h2>

      {!collection.sources?.length ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-sm text-zinc-500">No sources yet. Add your first RSS feed above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {collection.sources.map((source) => (
            <div key={source.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{source.title || source.feed_url}</p>
                <p className="mt-0.5 text-xs text-zinc-500 truncate">{source.feed_url}</p>
              </div>
              <button
                onClick={() => removeSource(source.id)}
                className="ml-4 shrink-0 text-sm text-zinc-500 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
