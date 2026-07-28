// ---- Types ----

export interface Tag {
  id: string;
  name: string;
  slug: string;
  facet: string;
}

export interface FeedItem {
  articleId: string;
  position: number;
  title: string;
  link: string;
  pubDate: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceId: string;
  image?: string;
  contentSnippet: string;
  content: string;
  tags: Tag[];
}

export type Page =
  | { type: "cover" }
  | { type: "context" }
  | { type: "article"; item: FeedItem }
  | { type: "section"; topics: Tag[] }
  | { type: "editor" }
  | { type: "closing"; count: number };

// ---- composePages ----

const CHUNK_SIZE = 5;

/**
 * Compose a sequence of pages for a daily issue from a flat list of feed items.
 *
 * Page ordering:
 *   Cover → Context → [articles in groups of 5, each followed by a Section
 *   that collects unique topic tags from those 5 articles] →
 *   Editor (inserted at floor(count/2) position, replacing the Section
 *   that would appear there) → Closing
 *
 * A Section is suppressed (omitted) when fewer than 3 articles remain after it.
 */
export function composePages(
  issue: { count: number },
  items: FeedItem[],
): Page[] {
  const pages: Page[] = [];
  const { count } = issue;

  // Always open with Cover then Context
  pages.push({ type: "cover" });
  pages.push({ type: "context" });

  const editorPosition = Math.floor(count / 2);
  let articlesProcessed = 0;
  let editorInserted = false;

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);

    // Add article pages for this chunk
    for (const item of chunk) {
      pages.push({ type: "article", item });
    }
    articlesProcessed += chunk.length;

    // Editor replaces the Section slot at the midpoint
    if (!editorInserted && articlesProcessed >= editorPosition) {
      pages.push({ type: "editor" });
      editorInserted = true;
      continue; // skip the Section that Editor replaces
    }

    // Section after each chunk (unless suppressed)
    if (articlesProcessed < count) {
      const remaining = count - articlesProcessed;
      if (remaining >= 3) {
        // Collect unique topic tags from this chunk
        const tagMap = new Map<string, Tag>();
        for (const item of chunk) {
          for (const tag of item.tags) {
            if (!tagMap.has(tag.id)) {
              tagMap.set(tag.id, tag);
            }
          }
        }
        pages.push({ type: "section", topics: Array.from(tagMap.values()) });
      }
      // else: suppress final Section (< 3 articles remain after it)
    }
  }

  // Always close with Closing
  pages.push({ type: "closing", count });

  return pages;
}
