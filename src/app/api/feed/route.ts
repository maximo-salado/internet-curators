// @ts-nocheck — Supabase nested join types don't match runtime
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import Parser from "rss-parser";

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function extractFirstImg(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

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
  const serviceClient = createServiceClient();
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") ?? "latest";

  // "Your Feed" mode
  const feedMode = searchParams.get("feed");
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
    followedIds = searchParams.get("followed")?.split(",").filter(Boolean) ?? [];
  }

  // 1. Get all sources with curator info
  const { data: sources, error } = await supabase
    .from("sources")
    .select("id, feed_url, title, site_url, last_fetched_at, collection_id, collections(curator_id, published, curators(display_name, id))");

  if (error || !sources?.length) return NextResponse.json([]);

  // 2. Refresh stale sources
  const now = Date.now();
  const parser = new Parser();

  await Promise.all(
    sources.map(async (source) => {
      const lastFetch = source.last_fetched_at
        ? new Date(source.last_fetched_at).getTime()
        : 0;
      if (now - lastFetch < CACHE_TTL) return; // cache is fresh

      try {
        const feed = await new Promise<any>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("timeout")), 8000);
          parser.parseURL(source.feed_url).then(
            (result) => { clearTimeout(timer); resolve(result); },
            (err) => { clearTimeout(timer); reject(err); }
          );
        });

        // Upsert each article
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

        // Update last_fetched_at
        await serviceClient
          .from("sources")
          .update({ last_fetched_at: new Date().toISOString() })
          .eq("id", source.id);
      } catch {
        // Mark as fetched anyway to avoid retrying dead feeds on every request
        await serviceClient
          .from("sources")
          .update({ last_fetched_at: new Date().toISOString() })
          .eq("id", source.id);
      }
    })
  );

  // 3. Read articles from DB, joined through to curator info
  const sourceIds = sources.map((s) => s.id);

  let query = supabase
    .from("articles")
    .select(`
      title, link, pub_date, content_snippet, image,
      sources!inner(title, site_url, collection_id,
        collections!inner(curator_id, published,
          curators!inner(display_name, id)
        )
      )
    `)
    .in("source_id", sourceIds)
    .order("pub_date", { ascending: false })
    .limit(200);

  const { data: articles } = await query;
  if (!articles?.length) return NextResponse.json([]);

  // 4. Deduplicate by link, merge curator names
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

  let items = Array.from(seen.values());

  // 5. "Your Feed" filter
  if (feedMode === "your" && userCuratorId) {
    items = items.filter((item) => {
      if (item.curatorIds.includes(userCuratorId)) return true;
      return item.publishedCurators.size > 0 &&
        item.curatorIds.some((id) => followedIds.includes(id));
    });
  }

  // 6. Two-tier attribution: strip names from private-only articles
  items = items.map(({ publishedCurators, ...item }) => {
    if (publishedCurators.size === 0) {
      return { ...item, curatorNames: [] as string[] };
    }
    return item;
  });

  // 7. Sort
  if (sort === "popular") {
    items.sort((a, b) => b.curatorNames.length - a.curatorNames.length);
  } else {
    items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  }

  // 7b. Interleave by source so no source dominates consecutively
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

  // 8. Attach vote counts
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
