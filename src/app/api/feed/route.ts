import { createClient } from "@/lib/supabase/server";
import { refreshStaleSources } from "@/lib/feed-refresher";
import { NextResponse } from "next/server";

interface FeedItem {
  articleId: string;
  title: string;
  link: string;
  pubDate: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceId: string;
  feedUrl: string;
  contentSnippet: string;
  image?: string;
  tags?: { id: string; name: string; slug: string; facet: string }[];
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

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") ?? "latest";
  const seed = searchParams.get("seed");
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
  const tagSlugs = searchParams.get("tags")?.split(",").filter(Boolean) ?? [];

  // 1. Get all sources
  const { data: sources } = await supabase
    .from("sources")
    .select("id, feed_url, title, site_url");

  if (!sources?.length) return NextResponse.json({ items: [], total: 0, hasMore: false });

  const sourceIds = sources.map((s) => s.id);

  // 2. Get articles from all sources — simple join, no curator gating
  const { data: articles } = await supabase
    .from("articles")
    .select(`
      id, title, link, pub_date, content_snippet, image, source_id,
      sources!inner(id, title, feed_url, site_url)
    `)
    .in("source_id", sourceIds)
    .order("pub_date", { ascending: false })
    .limit(200);

  if (!articles?.length) return NextResponse.json({ items: [], total: 0, hasMore: false });

  // 3. Deduplicate by link
  const seen = new Map<string, FeedItem>();
  for (const a of articles) {
    const s = a.sources as any;
    const link = a.link;
    if (seen.has(link)) continue;
    seen.set(link, {
      articleId: a.id,
      title: a.title,
      link,
      pubDate: a.pub_date,
      sourceTitle: s?.title || "Unknown",
      sourceUrl: s?.site_url || "",
      sourceId: a.source_id || s?.id || "",
      feedUrl: s?.feed_url || "",
      contentSnippet: a.content_snippet ?? "",
      image: a.image ?? undefined,
    });
  }

  let items: FeedItem[] = Array.from(seen.values());

  // 4. Filter by tags
  if (tagSlugs.length > 0) {
    const { data: directFilterTags } = await supabase
      .from("tags")
      .select("id, slug, parent_id")
      .in("slug", tagSlugs);

    if (!directFilterTags?.length) {
      return NextResponse.json({ items: [], total: 0, hasMore: false });
    }

    const directIds = directFilterTags.map((t: any) => t.id);
    const { data: childTags } = await supabase
      .from("tags")
      .select("id, parent_id")
      .in("parent_id", directIds);

    const slugToEffectiveIds = new Map<string, string[]>();
    for (const ft of directFilterTags) {
      const children = (childTags ?? []).filter((c: any) => c.parent_id === ft.id);
      slugToEffectiveIds.set(ft.slug, children.length > 0 ? children.map((c: any) => c.id) : [ft.id]);
    }

    const allFilterTagIds = [...new Set([...slugToEffectiveIds.values()].flat())];
    const articleLinks = items.map((i) => i.link);

    const { data: keywordTags } = await supabase
      .from("article_tags")
      .select("tag_id, articles!inner(link)")
      .in("tag_id", allFilterTagIds)
      .in("articles.link", articleLinks);

    const pageSourceIds = [...new Set(items.map((i) => i.sourceId).filter(Boolean))];

    const { data: inheritedTags } = await supabase
      .from("source_tags")
      .select("tag_id, source_id")
      .in("tag_id", allFilterTagIds)
      .in("source_id", pageSourceIds);

    const articleTagMap = new Map<string, Set<string>>();

    for (const kt of keywordTags ?? []) {
      const link = (kt.articles as any)?.link;
      if (!link) continue;
      if (!articleTagMap.has(link)) articleTagMap.set(link, new Set());
      articleTagMap.get(link)!.add(kt.tag_id);
    }

    const sourceIdToLinks = new Map<string, string[]>();
    for (const item of items) {
      const sid = item.sourceId;
      if (!sid) continue;
      if (!sourceIdToLinks.has(sid)) sourceIdToLinks.set(sid, []);
      sourceIdToLinks.get(sid)!.push(item.link);
    }

    for (const it of inheritedTags ?? []) {
      const links = sourceIdToLinks.get(it.source_id) ?? [];
      for (const link of links) {
        if (!articleTagMap.has(link)) articleTagMap.set(link, new Set());
        articleTagMap.get(link)!.add(it.tag_id);
      }
    }

    const matchingLinks = new Set<string>();
    for (const [link, tagSet] of articleTagMap) {
      const allMatch = [...slugToEffectiveIds.values()].every((ids) =>
        ids.some((id) => tagSet.has(id))
      );
      if (allMatch) matchingLinks.add(link);
    }

    items = items.filter((item) => matchingLinks.has(item.link));
  }

  // 5. Sort or seed-based shuffle
  if (seed) {
    items = seededShuffle(items, seed);
  } else {
    items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
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

  // 6. Paginate
  const total = items.length;
  const page = items.slice(offset, offset + limit);
  const hasMore = offset + limit < total;
  const links = page.map((i) => i.link);

  // 7. Attach vote counts
  const { data: votes } = await supabase
    .from("article_votes")
    .select("link, upvotes, downvotes")
    .in("link", links);

  const voteMap = new Map<string, { upvotes: number; downvotes: number }>();
  for (const v of votes ?? []) {
    voteMap.set(v.link, { upvotes: v.upvotes, downvotes: v.downvotes });
  }

  // 8. Attach tags
  const pageSourceIds = [...new Set(page.map((i) => i.sourceId).filter(Boolean))];

  const { data: articleTags } = await supabase
    .from("article_tags")
    .select("tag_id, articles!inner(link), tags(id, name, slug, facet)")
    .in("articles.link", links);

  const { data: sourceTags } = await supabase
    .from("source_tags")
    .select("source_id, tag_id, tags(id, name, slug, facet)")
    .in("source_id", pageSourceIds);

  const sourceTagMap = new Map<string, { id: string; name: string; slug: string; facet: string }[]>();
  for (const st of sourceTags ?? []) {
    if (!sourceTagMap.has(st.source_id)) sourceTagMap.set(st.source_id, []);
    sourceTagMap.get(st.source_id)!.push(st.tags as any);
  }

  const keywordTagMap = new Map<string, { id: string; name: string; slug: string; facet: string }[]>();
  for (const at of articleTags ?? []) {
    const link = (at.articles as any)?.link;
    if (!link) continue;
    if (!keywordTagMap.has(link)) keywordTagMap.set(link, []);
    keywordTagMap.get(link)!.push(at.tags as any);
  }

  const withTags = page.map((item) => {
    const keyword = keywordTagMap.get(item.link) ?? [];
    const inherited = sourceTagMap.get(item.sourceId) ?? [];
    const seen = new Set<string>();
    const merged: { id: string; name: string; slug: string; facet: string }[] = [];
    for (const t of [...keyword, ...inherited]) {
      if (t && !seen.has(t.id)) { seen.add(t.id); merged.push(t); }
    }
    return {
      ...item,
      upvotes: voteMap.get(item.link)?.upvotes ?? 0,
      downvotes: voteMap.get(item.link)?.downvotes ?? 0,
      tags: merged,
    };
  });

  return NextResponse.json({ items: withTags, total, hasMore });
}

// Triggered by a cron job or manual call to refresh stale RSS sources into the articles cache.
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
