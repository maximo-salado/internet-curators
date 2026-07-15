"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface CuratorResult {
  id: string;
  display_name: string;
  bio: string;
}

interface CollectionResult {
  id: string;
  name: string;
  description: string;
  slug: string;
  curatorName: string;
}

type Tab = "curators" | "collections";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("curators");
  const [curators, setCurators] = useState<CuratorResult[]>([]);
  const [collections, setCollections] = useState<CollectionResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setCurators([]);
      setCollections([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setCurators(data.curators ?? []);
        setCollections(data.collections ?? []);
      } catch {}
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const results = tab === "curators" ? curators : collections;
  const hasQuery = query.length >= 2;

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      {/* Search input */}
      <input
        type="text"
        placeholder="Search curators or collections..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-200 outline-none placeholder:text-zinc-500 focus:border-zinc-500 transition-colors"
      />

      {hasQuery && (
        <>
          {/* Tabs */}
          <div className="mt-4 flex border-b border-zinc-800">
            <button
              onClick={() => setTab("curators")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === "curators" ? "text-zinc-100 border-b border-zinc-100 -mb-px" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Curators
            </button>
            <button
              onClick={() => setTab("collections")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === "collections" ? "text-zinc-100 border-b border-zinc-100 -mb-px" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Collections
            </button>
          </div>

          {/* Results */}
          <div className="mt-2">
            {loading ? (
              <p className="py-8 text-center text-sm text-zinc-500">Searching...</p>
            ) : results.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                No {tab} found for "{query}"
              </p>
            ) : tab === "curators" ? (
              <div className="divide-y divide-zinc-800">
                {(results as CuratorResult[]).map((c) => (
                  <Link
                    key={c.id}
                    href={`/curator/${c.id}`}
                    className="flex items-center gap-3 py-3 hover:bg-zinc-900/50 transition-colors -mx-4 px-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-medium text-zinc-300">
                      {c.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-200">{c.display_name}</div>
                      {c.bio && <div className="text-xs text-zinc-500 truncate">{c.bio}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {(results as CollectionResult[]).map((c) => (
                  <Link
                    key={c.id}
                    href={`/collections/${c.slug}`}
                    className="block py-3 hover:bg-zinc-900/50 transition-colors -mx-4 px-4"
                  >
                    <div className="text-sm font-medium text-zinc-200">{c.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {c.description || `by ${c.curatorName}`}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {!hasQuery && (
        <p className="py-16 text-center text-sm text-zinc-600">
          Search for curators and collections
        </p>
      )}
    </main>
  );
}
