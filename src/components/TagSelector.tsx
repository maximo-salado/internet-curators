"use client";

interface Tag {
  id: string;
  name: string;
  slug: string;
  facet: string;
  parent_id: string | null;
}

interface TagSelectorProps {
  allTags: Tag[];
  selectedTagIds: Set<string>;
  onToggle: (tagId: string) => void;
  facets: string[];
  readonly?: boolean;
}

export function TagSelector({ allTags, selectedTagIds, onToggle, facets, readonly }: TagSelectorProps) {
  return (
    <>
      {facets.includes("topic") && (() => {
        const parents = allTags.filter((t) => t.facet === "topic" && t.parent_id === null);
        const children = allTags.filter((t) => t.facet === "topic" && t.parent_id !== null);
        if (children.length === 0) return null;
        return (
          <div className="mb-1">
            <span className="text-[9px] text-zinc-600 mr-1">topic:</span>
            {parents.map((parent) => {
              const group = children.filter((c) => c.parent_id === parent.id);
              if (group.length === 0) return null;
              return (
                <div key={parent.id} className="mt-1">
                  <span className="text-[8px] text-zinc-700 uppercase tracking-wider">{parent.name}</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {group.map((tag) => {
                      const isSelected = selectedTagIds.has(tag.id);
                      const chipClass = readonly
                        ? isSelected
                          ? "rounded px-1.5 py-0.5 text-[10px] bg-green-900/50 text-green-300 border border-green-800"
                          : "hidden"
                        : `rounded px-1.5 py-0.5 text-[10px] transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-green-900/50 text-green-300 border border-green-800"
                              : "bg-zinc-800 text-zinc-500 border border-zinc-700 hover:border-zinc-600"
                          }`;
                      return (
                        <button
                          key={tag.id}
                          onClick={() => !readonly && onToggle(tag.id)}
                          disabled={readonly}
                          className={chipClass}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {facets.filter((f) => f !== "topic").map((facet) => {
        const facetTags = allTags.filter((t) => t.facet === facet && t.parent_id === null);
        if (facetTags.length === 0) return null;
        return (
          <div key={facet} className="mb-1">
            <span className="text-[9px] text-zinc-600 mr-1">{facet}:</span>
            <div className="flex flex-wrap gap-1">
              {facetTags.map((tag) => {
                const isSelected = selectedTagIds.has(tag.id);
                const chipClass = readonly
                  ? isSelected
                    ? "bg-green-900/50 text-green-300 border border-green-800"
                    : "hidden"
                  : `rounded px-1.5 py-0.5 text-[10px] transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-green-900/50 text-green-300 border border-green-800"
                        : "bg-zinc-800 text-zinc-500 border border-zinc-700 hover:border-zinc-600"
                    }`;
                return (
                  <button
                    key={tag.id}
                    onClick={() => !readonly && onToggle(tag.id)}
                    disabled={readonly}
                    className={chipClass}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
