import { createServiceClient } from "@/lib/supabase/service";
import Parser from "rss-parser";

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// --- Taxonomy keyword matching ---
interface TagKeyword {
  tag_id: string;
  keywords: string[];
}

let tagKeywordsCache: TagKeyword[] | null = null;

async function loadTagKeywords(supabase: any): Promise<TagKeyword[]> {
  if (tagKeywordsCache) return tagKeywordsCache;
  const { data } = await supabase
    .from("tags")
    .select("id, keywords")
    .in("facet", ["topic", "voice"])
    .not("keywords", "eq", "{}");
  tagKeywordsCache = (data ?? []).map((t: any) => ({
    tag_id: t.id,
    keywords: t.keywords,
  }));
  return tagKeywordsCache!;
}

function matchKeywords(text: string, tagKeywords: TagKeyword[]): string[] {
  const lower = text.toLowerCase();
  const matches: string[] = [];
  for (const tk of tagKeywords) {
    for (const kw of tk.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        matches.push(tk.tag_id);
        break;
      }
    }
  }
  return matches;
}

function extractFirstImg(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

/**
 * rss-parser / xml2js can produce object trees instead of strings for Atom XHTML
 * content (e.g. <title type="xhtml"><div>...</div></title>). This walks the tree
 * to recover the plain text. Falls back to empty string for unrecognised shapes.
 */
function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const obj = value as Record<string, unknown>;
  // leaf text node
  if (typeof obj._ === "string") return obj._;
  // recurse over children, skip attribute blocks (key === "$")
  let text = "";
  for (const [key, val] of Object.entries(obj)) {
    if (key === "$") continue;
    if (Array.isArray(val)) {
      for (const v of val) text += extractText(v);
    } else if (typeof val === "object") {
      text += extractText(val);
    }
  }
  return text;
}

/**
 * xml2js Builder adds namespace prefixes (e.g. <default:div>) when rebuilding
 * XHTML content. Strip those so the HTML is valid for browser rendering.
 */
function cleanXhtmlContent(html: string): string {
  return html
    .replace(/<\/?default:/g, "</")
    .replace(/<\/?[a-z]+:/g, "</");
}

export type RefreshSource = {
  id: string;
  feed_url: string;
  last_fetched_at: string | null;
};

export async function refreshStaleSources(sources: RefreshSource[]): Promise<void> {
  const now = Date.now();
  const parser = new Parser();

  await Promise.all(
    sources.map(async (source) => {
      const lastFetch = source.last_fetched_at
        ? new Date(source.last_fetched_at).getTime()
        : 0;
      if (now - lastFetch < CACHE_TTL) return;

      const serviceClient = createServiceClient();
      try {
        const feed = await new Promise<any>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("timeout")), 8000);
          parser.parseURL(source.feed_url).then(
            (result) => { clearTimeout(timer); resolve(result); },
            (err) => { clearTimeout(timer); reject(err); }
          );
        });

        for (const item of feed.items ?? []) {
          const img =
            item.enclosure?.url && item.enclosure?.type?.startsWith("image/")
              ? item.enclosure.url
              : (item as any)["media:content"]?.$.url
                || (item as any)["media:thumbnail"]?.$.url
                || extractFirstImg((item as any)["content:encoded"])
                || extractFirstImg(item.content)
                || extractFirstImg(item.description)
                || undefined;

          const article = {
            source_id: source.id,
            title: extractText(item.title) || "Untitled",
            link: item.link ?? "",
            pub_date: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
            content_snippet: (extractText(item.contentSnippet) || "").slice(0, 500),
            content: cleanXhtmlContent(
              (item as any)["content:encoded"] || item.content || item.contentSnippet || ""
            ),
            image: img ?? null,
          };

          if (!article.link) continue;

          await serviceClient.from("articles").upsert(article, {
            onConflict: "source_id,link",
            ignoreDuplicates: false,
          });

          // --- Tag resolution (keyword-matched only — inherited tags resolve at query time) ---
          const tagKeywords = await loadTagKeywords(serviceClient);
          const searchText = [article.title, article.content_snippet ?? ""].join(" ");
          const keywordTagIds = matchKeywords(searchText, tagKeywords);

          if (keywordTagIds.length > 0) {
            const { data: existingArticle } = await serviceClient
              .from("articles")
              .select("id")
              .eq("source_id", source.id)
              .eq("link", article.link)
              .single();

            if (existingArticle) {
              await serviceClient
                .from("article_tags")
                .delete()
                .eq("article_id", existingArticle.id);

              const tagRows = keywordTagIds.map((tag_id) => ({
                article_id: existingArticle.id,
                tag_id,
              }));

              await serviceClient.from("article_tags").insert(tagRows);
            }
          }
        }

        await serviceClient
          .from("sources")
          .update({ last_fetched_at: new Date().toISOString() })
          .eq("id", source.id);
      } catch {
        // Mark as fetched anyway to avoid hammering dead feeds on every request
        await serviceClient
          .from("sources")
          .update({ last_fetched_at: new Date().toISOString() })
          .eq("id", source.id);
      }
    })
  );
}
