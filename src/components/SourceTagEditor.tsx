"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TagSelector } from "./TagSelector";

interface Tag {
  id: string;
  name: string;
  slug: string;
  facet: string;
  parent_id: string | null;
}

interface SourceTagEditorProps {
  sourceId: string;
  initialTagIds: string[];
  allTags: Tag[];
}

export function SourceTagEditor({ sourceId, initialTagIds, allTags }: SourceTagEditorProps) {
  const router = useRouter();
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set(initialTagIds));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/sources/${sourceId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_ids: [...selectedTagIds] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save tags");
      }
      setFeedback({ type: "success", message: "Tags saved" });
      router.refresh();
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to save tags" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 border-t border-zinc-800 pt-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-zinc-300">Tags</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-green-900/30 border border-green-800 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-900/50 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Tags"}
        </button>
      </div>
      {feedback && (
        <p className={`text-xs mb-2 ${feedback.type === "success" ? "text-green-400" : "text-red-400"}`}>
          {feedback.message}
        </p>
      )}
      <TagSelector
        allTags={allTags}
        selectedTagIds={selectedTagIds}
        onToggle={(tagId) => {
          setSelectedTagIds((prev) => {
            const next = new Set(prev);
            prev.has(tagId) ? next.delete(tagId) : next.add(tagId);
            return next;
          });
          setFeedback(null);
        }}
        facets={["topic", "stance", "format"]}
      />
    </div>
  );
}
