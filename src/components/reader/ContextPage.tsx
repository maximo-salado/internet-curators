import type { Page } from "@/lib/compose-pages";
import { editorConfig } from "@/lib/editor-config";

interface ContextPageProps {
  issueNumber: number;
  issueDate: string;
  pages: Page[];
  onNavigate: (index: number) => void;
}

/**
 * Page 1 — the magazine's opening spread: per-issue editorial context (date,
 * number, topics), the editor's note, and a tappable contents index that jumps
 * to any article.
 */
export function ContextPage({
  issueNumber,
  issueDate,
  pages,
  onNavigate,
}: ContextPageProps) {
  // Article entries with their page index (for the contents index + jump)
  const articles: { title: string; source: string; index: number }[] = [];
  const topicSet = new Map<string, string>();
  pages.forEach((page, index) => {
    if (page.type === "article") {
      articles.push({
        title: page.item.title,
        source: page.item.sourceTitle,
        index,
      });
      for (const tag of page.item.tags) {
        if (tag.facet === "topic" && !topicSet.has(tag.id)) {
          topicSet.set(tag.id, tag.name);
        }
      }
    }
  });
  const topics = Array.from(topicSet.values()).slice(0, 8);

  const dateLabel = new Date(issueDate + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" },
  );

  return (
    <div
      className="h-full overflow-y-auto subtle-scroll px-6 py-16 sm:px-12"
      data-scroll-container="true"
    >
      <div className="mx-auto max-w-prose">
        {/* Masthead */}
        <div className="text-center">
          <div className="font-serif text-4xl font-bold text-zinc-100">
            #{issueNumber}
          </div>
          <div className="mt-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
            {dateLabel}
          </div>
          <div className="mt-1 text-xs text-zinc-600">
            {articles.length} {articles.length === 1 ? "article" : "articles"}
          </div>
        </div>

        {/* Per-issue context — topics covered */}
        {topics.length > 0 && (
          <p className="mt-8 text-center text-sm leading-relaxed text-zinc-400">
            In this issue — {topics.join(" · ")}
          </p>
        )}

        {/* Editor's note (folded in from the old mid-issue editor page) */}
        <div className="mx-auto mt-10 border-t border-zinc-800 pt-8 text-center">
          <p className="text-sm leading-relaxed text-zinc-300">
            {editorConfig.note}
          </p>
          <p className="mt-3 text-xs uppercase tracking-widest text-zinc-500">
            — {editorConfig.name}, editor
          </p>
        </div>

        {/* Contents index — tap to jump */}
        <div className="mt-12 border-t border-zinc-800 pt-8">
          <h3 className="mb-3 text-xs uppercase tracking-[0.25em] text-zinc-500">
            Contents
          </h3>
          <ol className="space-y-1">
            {articles.map(({ title, source, index }, i) => (
              <li key={index}>
                <button
                  onClick={() => onNavigate(index)}
                  className="group flex w-full items-baseline gap-3 rounded-md px-1 py-2 text-left transition-colors hover:bg-zinc-900"
                >
                  <span className="w-6 shrink-0 text-right text-xs tabular-nums text-zinc-600">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm text-zinc-200 group-hover:text-white">
                      {title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      {source}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
