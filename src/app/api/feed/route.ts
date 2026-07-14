// @ts-nocheck — Supabase nested join types don't match runtime
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Parser from "rss-parser";

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  sourceTitle: string;
  sourceUrl: string;
  curatorNames: string[];
  curatorIds: string[];
  contentSnippet: string;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") ?? "latest";

  const { data: sources, error } = await supabase
    .from("sources")
    .select("id, feed_url, title, site_url, collection_id, collections(curator_id, curators(display_name, id))");

  if (error || !sources?.length) return NextResponse.json([]);

  const parser = new Parser();
  const allItems: FeedItem[] = [];

  interface SourceRow {
    feed_url: string;
    title: string;
    site_url: string;
    collections: { curator_id: string; curators: { display_name: string; id: string } } | null;
  }

  await Promise.all(
    sources.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.feed_url);
        const curatorName = source.collections?.curators?.display_name ?? "Unknown";
        const curatorId = source.collections?.curator_id ?? null;

        for (const item of feed.items ?? []) {
          allItems.push({
            title: item.title ?? "Untitled",
            link: item.link ?? "",
            pubDate: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
            sourceTitle: source.title || feed.title || source.feed_url,
            sourceUrl: source.site_url || feed.link || "",
            curatorNames: [curatorName],
            curatorIds: curatorId ? [curatorId] : [],
            contentSnippet: (item.contentSnippet ?? "").slice(0, 300),
          });
        }
      } catch {}
    })
  );

  // Deduplicate by link, merge curator names
  const seen = new Map<string, FeedItem>();
  for (const item of allItems) {
    const existing = seen.get(item.link);
    if (existing) {
      existing.curatorNames = [...new Set([...existing.curatorNames, ...item.curatorNames])];
      existing.curatorIds = [...new Set([...existing.curatorIds, ...item.curatorIds])];
    } else {
      seen.set(item.link, item);
    }
  }

  const items = Array.from(seen.values());

  if (sort === "popular") {
    items.sort((a, b) => b.curatorNames.length - a.curatorNames.length);
  } else {
    items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  }

  return NextResponse.json(items.slice(0, 50));
}
