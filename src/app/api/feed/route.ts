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
  image?: string;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") ?? "latest";

  // "Your Feed" mode: filter to user's own sources + followed curators' published
  const feedMode = searchParams.get("feed"); // "your" or undefined (global)
  let userCuratorId: string | null = null;
  let followedIds: string[] = [];

  if (feedMode === "your") {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: curator } = await supabase
        .from("curators")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (curator) userCuratorId = curator.id;
    }
    // followedIds come from client localStorage, passed as query param
    followedIds = searchParams.get("followed")?.split(",").filter(Boolean) ?? [];
  }

  const { data: sources, error } = await supabase
    .from("sources")
    .select("id, feed_url, title, site_url, collection_id, collections(curator_id, published, curators(display_name, id))");

  if (error || !sources?.length) return NextResponse.json([]);

  // Map curator_id -> published for quick lookup
  const curatorPublished = new Map<string, boolean>();
  for (const s of sources) {
    const cid = s.collections?.curator_id;
    if (cid) {
      const current = curatorPublished.get(cid) ?? false;
      curatorPublished.set(cid, current || (s.collections?.published ?? false));
    }
  }

  const parser = new Parser();
  const allItems: (FeedItem & { publishedCurators: Set<string> })[] = [];

  await Promise.all(
    sources.map(async (source) => {
      try {
        const feed = await new Promise<any>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("timeout")), 8000);
          parser.parseURL(source.feed_url).then(
            (result) => { clearTimeout(timer); resolve(result); },
            (err) => { clearTimeout(timer); reject(err); }
          );
        });
        const curatorName = source.collections?.curators?.display_name ?? "Unknown";
        const curatorId = source.collections?.curator_id ?? null;
        const isPublished = source.collections?.published ?? false;

        for (const item of feed.items ?? []) {
          const img =
            item.enclosure?.url && item.enclosure?.type?.startsWith("image/")
              ? item.enclosure.url
              : (item as any)["media:content"]?.$.url || (item as any)["media:thumbnail"]?.$.url || undefined;

          allItems.push({
            title: item.title ?? "Untitled",
            link: item.link ?? "",
            pubDate: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
            sourceTitle: source.title || feed.title || source.feed_url,
            sourceUrl: source.site_url || feed.link || "",
            curatorNames: [curatorName],
            curatorIds: curatorId ? [curatorId] : [],
            contentSnippet: (item.contentSnippet ?? "").slice(0, 300),
            content: (item as any)["content:encoded"] || item.content || (item.contentSnippet ?? ""),
            publishedCurators: new Set(isPublished && curatorId ? [curatorId] : []),
            ...(img ? { image: img } : {}),
          });
        }
      } catch {}
    })
  );

  // Deduplicate by link
  const seen = new Map<string, FeedItem & { publishedCurators: Set<string> }>();
  for (const item of allItems) {
    const existing = seen.get(item.link);
    if (existing) {
      existing.curatorNames = [...new Set([...existing.curatorNames, ...item.curatorNames])];
      existing.curatorIds = [...new Set([...existing.curatorIds, ...item.curatorIds])];
      item.publishedCurators.forEach((id) => existing.publishedCurators.add(id));
    } else {
      seen.set(item.link, { ...item });
    }
  }

  let items = Array.from(seen.values());

  // "Your Feed" filter (server-side)
  if (feedMode === "your" && userCuratorId) {
    items = items.filter((item) => {
      // Always include: articles from user's own sources
      if (item.curatorIds.includes(userCuratorId)) return true;
      // Include: published articles from followed curators
      return item.publishedCurators.size > 0 &&
        item.curatorIds.some((id) => followedIds.includes(id));
    });
  }

  // Strip curator names from private-only articles (two-tier attribution)
  items = items.map(({ publishedCurators, ...item }) => {
    if (publishedCurators.size === 0) {
      return { ...item, curatorNames: [] as string[] };
    }
    return item;
  });

  if (sort === "popular") {
    items.sort((a, b) => b.curatorNames.length - a.curatorNames.length);
  } else {
    items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  }

  // Attach vote counts
  const sliced = items.slice(0, 50);
  const links = sliced.map((i) => i.link);
  const { data: votes } = await supabase
    .from("article_votes")
    .select("link, upvotes, downvotes")
    .in("link", links);

  const voteMap = new Map<string, { upvotes: number; downvotes: number }>();
  for (const v of votes ?? []) {
    voteMap.set(v.link, { upvotes: v.upvotes, downvotes: v.downvotes });
  }

  const withVotes = sliced.map((item) => ({
    ...item,
    upvotes: voteMap.get(item.link)?.upvotes ?? 0,
    downvotes: voteMap.get(item.link)?.downvotes ?? 0,
  }));

  return NextResponse.json(withVotes);
}
