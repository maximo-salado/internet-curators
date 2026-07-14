"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

type SearchTab = "curators" | "collections";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SearchTab>("curators");
  const [open, setOpen] = useState(false);
  const [curators, setCurators] = useState<CuratorResult[]>([]);
  const [collections, setCollections] = useState<CollectionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

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
  const showOverlay = open && query.length >= 2;

  function handleSelect() {
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        placeholder="Search curators or collections..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => { if (query.length >= 2) setOpen(true); }}
        className="w-56 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-500 focus:border-zinc-500 transition-colors"
      />

      {showOverlay && (
        <div className="absolute left-0 top-10 w-80 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl z-50">
          {/* Tabs */}
          <div className="flex border-b border-zinc-800">
            <button
              onClick={() => setTab("curators")}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === "curators"
                  ? "text-zinc-100 border-b border-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Curators
            </button>
            <button
              onClick={() => setTab("collections")}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === "collections"
                  ? "text-zinc-100 border-b border-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Collections
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-zinc-500">Searching...</div>
            ) : results.length === 0 ? (
              <div className="p-4 text-sm text-zinc-500">
                No {tab} found for "{query}"
              </div>
            ) : tab === "curators" ? (
              (results as CuratorResult[]).map((c) => (
                <Link
                  key={c.id}
                  href={`/curator/${c.id}`}
                  onClick={handleSelect}
                  className="block px-4 py-3 hover:bg-zinc-800 transition-colors"
                >
                  <div className="text-sm font-medium text-zinc-200">{c.display_name}</div>
                  {c.bio && <div className="text-xs text-zinc-500 truncate mt-0.5">{c.bio}</div>}
                </Link>
              ))
            ) : (
              (results as CollectionResult[]).map((c) => (
                <Link
                  key={c.id}
                  href={`/collections/${c.slug}`}
                  onClick={handleSelect}
                  className="block px-4 py-3 hover:bg-zinc-800 transition-colors"
                >
                  <div className="text-sm font-medium text-zinc-200">{c.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">by {c.curatorName}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
