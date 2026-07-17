import { createClient } from "@/lib/supabase/server";
import { refreshStaleSources } from "@/lib/feed-refresher";
import { NextResponse } from "next/server";

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceId: string;
  feedUrl: string;
  curatorNames: string[];
  curatorIds: string[];
  contentSnippet: string;
  image?: string;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  const rng = mulberry32(h);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") ?? "latest";
  const seed = searchParams.get("seed");
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

  // "Your Feed" mode — only user's own sources + followed
  // "Discover" mode — everything EXCEPT user's own sources
  const feedMode = searchParams.get("feed");
  let userCuratorId: string | null = null;
  let followedIds: string[] = [];
  let excludeUserSourceIds: string[] | null = null;

  if (feedMode === "your" || feedMode === "discover") {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: curator } = await supabase
        .from("curators")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (curator) userCuratorId = curator.id;
    }
    if (feedMode === "your") {
      // POC-only: followedIds are passed from the client via query params.
      // In production, follow relationships should be stored server-side.
      followedIds = searchParams.get("followed")?.split(",").filter(Boolean) ?? [];
    }
    if (feedMode === "discover" && userCuratorId) {
      const { data: userSources } = await supabase
        .from("sources")
        .select("id, collection_id, collections!inner(curator_id)")
        .eq("collections.curator_id", userCuratorId);
      excludeUserSourceIds = (userSources ?? []).map((s: any) => s.id);
    }
  }

  // 1. Get all source IDs with curator info (no RSS fetching — reads from articles cache)
  const { data: sources, error } = await supabase
    .from("sources")
    .select("id, feed_url, title, site_url, last_fetched_at, collection_id, collections(curator_id, published, curators(display_name, id))");

  if (error || !sources?.length) return NextResponse.json({ items: [], total: 0, hasMore: false });

  let sourceIds = sources.map((s) => s.id);

  if (excludeUserSourceIds && excludeUserSourceIds.length > 0) {
    sourceIds = sourceIds.filter((id) => !excludeUserSourceIds!.includes(id));
  }
  if (sourceIds.length === 0) return NextResponse.json({ items: [], total: 0, hasMore: false });

  // 2. Read articles from DB cache, joined through to curator info
  const { data: articles } = await supabase
    .from("articles")
    .select(`
      title, link, pub_date, content_snippet, image, source_id,
      sources!inner(id, title, feed_url, site_url, collection_id,
        collections!inner(curator_id, published,
          curators!inner(display_name, id)
        )
      )
    `)
    .in("source_id", sourceIds)
    .order("pub_date", { ascending: false })
    .limit(200);

  if (!articles?.length) return NextResponse.json({ items: [], total: 0, hasMore: false });

  // 3. Deduplicate by link, merge curator names
  const seen = new Map<string, FeedItem & { publishedCurators: Set<string> }>();

  for (const a of articles) {
    const s = a.sources as any;
    const c = s?.collections as any;
    const cu = c?.curators as any;
    const curatorName = cu?.display_name ?? "Unknown";
    const curatorId = cu?.id ?? null;
    const isPublished = c?.published ?? false;
    const link = a.link;

    const existing = seen.get(link);
    if (existing) {
      if (curatorName !== "Unknown") {
        existing.curatorNames = [...new Set([...existing.curatorNames, curatorName])];
      }
      if (curatorId) {
        existing.curatorIds = [...new Set([...existing.curatorIds, curatorId])];
      }
      if (isPublished && curatorId) {
        existing.publishedCurators.add(curatorId);
      }
    } else {
      seen.set(link, {
        title: a.title,
        link,
        pubDate: a.pub_date,
        sourceTitle: s?.title || "Unknown",
        sourceUrl: s?.site_url || "",
        sourceId: a.source_id || s?.id || "",
        feedUrl: s?.feed_url || "",
        curatorNames: curatorName !== "Unknown" ? [curatorName] : [],
        curatorIds: curatorId ? [curatorId] : [],
        contentSnippet: a.content_snippet ?? "",
        image: a.image ?? undefined,
        publishedCurators: new Set(
          isPublished && curatorId ? [curatorId] : []
        ),
      });
    }
  }

  let rawItems = Array.from(seen.values());

  // 4. "Your Feed" filter — only user's own sources + followed
  if (feedMode === "your") {
    if (!userCuratorId) {
      return NextResponse.json({ items: [], total: 0, hasMore: false });
    }
    rawItems = rawItems.filter((item) => {
      if (item.curatorIds.includes(userCuratorId!)) return true;
      return item.publishedCurators.size > 0 &&
        item.curatorIds.some((id) => followedIds.includes(id));
    });
  }

  // 5. Two-tier attribution: strip names from private-only articles
  let items: FeedItem[] = rawItems.map(({ publishedCurators, ...item }) => {
    if (publishedCurators.size === 0) {
      return { ...item, curatorNames: [] as string[] };
    }
    return item;
  });

  // 6. Sort or seed-based shuffle
  if (feedMode === "discover" && seed) {
    items = seededShuffle(items, seed);
  } else {
    if (sort === "popular") {
      items.sort((a, b) => b.curatorNames.length - a.curatorNames.length);
    } else {
      items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    }
    // Interleave by source so no source dominates consecutively
    const bySource = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.sourceTitle;
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key)!.push(item);
    }
    const sourceKeys = Array.from(bySource.keys());
    items = [];
    let idx = 0;
    while (items.length < 200 && sourceKeys.length > 0) {
      const sourceKey = sourceKeys[idx % sourceKeys.length];
      const bucket = bySource.get(sourceKey)!;
      if (bucket.length > 0) {
        items.push(bucket.shift()!);
      } else {
        sourceKeys.splice(idx % sourceKeys.length, 1);
        continue;
      }
      idx++;
    }
  }

  // 8. Attach vote counts (fetch for the requested page only)
  const total = items.length;
  const page = items.slice(offset, offset + limit);
  const hasMore = offset + limit < total;
  const links = page.map((i) => i.link);
  const { data: votes } = await supabase
    .from("article_votes")
    .select("link, upvotes, downvotes")
    .in("link", links);

  const voteMap = new Map<string, { upvotes: number; downvotes: number }>();
  for (const v of votes ?? []) {
    voteMap.set(v.link, { upvotes: v.upvotes, downvotes: v.downvotes });
  }

  const withVotes = page.map((item) => ({
    ...item,
    upvotes: voteMap.get(item.link)?.upvotes ?? 0,
    downvotes: voteMap.get(item.link)?.downvotes ?? 0,
  }));

  return NextResponse.json({ items: withVotes, total, hasMore });
}

// Triggered by a cron job or manual call to refresh stale RSS sources into the articles cache.
// Requires CRON_SECRET header to prevent unauthorized triggering.
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createClient();

  const { data: sources, error } = await supabase
    .from("sources")
    .select("id, feed_url, last_fetched_at");

  if (error || !sources?.length) {
    return NextResponse.json({ refreshed: 0 });
  }

  await refreshStaleSources(sources);

  return NextResponse.json({ refreshed: sources.length });
}
