"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Collection {
  id: string;
  name: string;
  description: string;
  slug: string;
  published: boolean;
  created_at: string;
}

export default function DashboardPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCollections(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function createCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() }),
    });
    if (res.ok) {
      const col = await res.json();
      setCollections([col, ...collections]);
      setName("");
      setDescription("");
      setShowForm(false);
      router.push(`/dashboard/collections/${col.slug}`);
    } else {
      const { error: msg } = await res.json();
      setError(msg || "Failed to create collection");
    }
    setSubmitting(false);
  }

  async function togglePublished(col: Collection) {
    const res = await fetch("/api/collections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: col.id, published: !col.published }),
    });
    if (res.ok) {
      setCollections(collections.map((c) =>
        c.id === col.id ? { ...c, published: !c.published } : c
      ));
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus("Importing...");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/import", { method: "POST", body: formData });
    const data = await res.json();
    if (res.ok) {
      setImportStatus(`Imported ${data.imported} feeds${data.skipped ? ` (${data.skipped} skipped)` : ""}`);
      fetch("/api/collections").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setCollections(d); });
    } else {
      setImportStatus(data.error || "Import failed");
    }
    e.target.value = "";
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-500 transition-colors">
            Import OPML
            <input type="file" accept=".opml,.xml" onChange={handleImport} className="hidden" />
          </label>
          <a
            href="/api/export"
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-500 transition-colors"
          >
            Export OPML
          </a>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 transition-colors"
          >
            {showForm ? "Cancel" : "New Collection"}
          </button>
        </div>
      </div>

      {importStatus && (
        <div className="mb-6 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
          {importStatus}
        </div>
      )}

      {showForm && (
        <form onSubmit={createCollection} className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Collection name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-white px-4 py-3 text-sm font-medium text-black hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Collection"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : collections.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-12 text-center">
          <p className="text-zinc-400">No collections yet.</p>
          <p className="mt-2 text-sm text-zinc-600">Create your first collection to start curating.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {collections.map((col) => (
            <div key={col.id} className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700 transition-colors">
              <Link href={`/dashboard/collections/${col.slug}`} className="min-w-0 flex-1">
                <h3 className="font-medium">{col.name}</h3>
                {col.description && <p className="mt-1 text-sm text-zinc-500">{col.description}</p>}
                <p className="mt-2 text-xs text-zinc-600">{col.slug}</p>
              </Link>
              <button
                onClick={() => togglePublished(col)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  col.published
                    ? "bg-green-900 text-green-400 hover:bg-green-800"
                    : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                }`}
              >
                {col.published ? "Published" : "Draft"}
              </button>
            </div>
          ))}
        </div>
      )}

      <HiddenItems />
    </main>
  );
}

function HiddenItems() {
  const [hidden, setHidden] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  useEffect(() => {
    setHidden(JSON.parse(localStorage.getItem("ic:hidden") ?? "[]"));
    setRemoved(JSON.parse(localStorage.getItem("ic:removedSources") ?? "[]"));
  }, []);

  if (hidden.length === 0 && removed.length === 0) return null;

  function restoreHidden(link: string) {
    const next = hidden.filter((l) => l !== link);
    setHidden(next);
    localStorage.setItem("ic:hidden", JSON.stringify(next));
    window.dispatchEvent(new Event("ic:hidden-updated"));
  }

  function restoreSource(source: string) {
    const next = removed.filter((s) => s !== source);
    setRemoved(next);
    localStorage.setItem("ic:removedSources", JSON.stringify(next));
    window.dispatchEvent(new Event("ic:removedSources-updated"));
  }

  function clearAll() {
    setHidden([]);
    setRemoved([]);
    localStorage.removeItem("ic:hidden");
    localStorage.removeItem("ic:removedSources");
    window.dispatchEvent(new Event("ic:hidden-updated"));
    window.dispatchEvent(new Event("ic:removedSources-updated"));
  }

  return (
    <div className="mt-12 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-zinc-300">Hidden &amp; Removed</h2>
        <button onClick={clearAll} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Clear all</button>
      </div>
      {hidden.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-zinc-500 mb-2">Hidden articles ({hidden.length})</p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((link) => (
              <button key={link} onClick={() => restoreHidden(link)} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors">
                {new URL(link).hostname}{new URL(link).pathname.slice(0, 20)} ↩
              </button>
            ))}
          </div>
        </div>
      )}
      {removed.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">Removed sources ({removed.length})</p>
          <div className="flex flex-wrap gap-2">
            {removed.map((source) => (
              <button key={source} onClick={() => restoreSource(source)} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors">
                {source} ↩
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
