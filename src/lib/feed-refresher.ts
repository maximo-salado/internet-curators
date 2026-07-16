import { createServiceClient } from "@/lib/supabase/service";
import Parser from "rss-parser";

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function extractFirstImg(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
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
            title: item.title ?? "Untitled",
            link: item.link ?? "",
            pub_date: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
            content_snippet: (item.contentSnippet ?? "").slice(0, 500),
            content: (item as any)["content:encoded"] || item.content || item.contentSnippet || "",
            image: img ?? null,
          };

          if (!article.link) continue;

          await serviceClient.from("articles").upsert(article, {
            onConflict: "source_id,link",
            ignoreDuplicates: false,
          });
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
