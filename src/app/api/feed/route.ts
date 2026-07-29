import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { refreshStaleSources } from "@/lib/feed-refresher";
import { estDateString } from "@/lib/dates";
import { NextResponse } from "next/server";

// ---- Types ----

interface Tag {
  id: string;
  name: string;
  slug: string;
  facet: string;
}

interface FeedItem {
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

interface IssueResponse {
  number: number;
  date: string;
  count: number;
  origin: string;
  isToday: boolean;
  published: boolean;
}

// ---- Source interleave helper ----
// Used by the snapshot job to interleave articles so no one source
// dominates consecutive positions in the daily issue.

export function interleaveBySource<T extends { sourceTitle: string }>(
  items: T[],
): T[] {
  const bySource = new Map<string, T[]>();
  for (const item of items) {
    const key = item.sourceTitle;
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key)!.push(item);
  }

  const sourceKeys = Array.from(bySource.keys());
  const result: T[] = [];
  let idx = 0;

  while (result.length < items.length && sourceKeys.length > 0) {
    const sourceKey = sourceKeys[idx % sourceKeys.length];
    const bucket = bySource.get(sourceKey)!;
    if (bucket.length > 0) {
      result.push(bucket.shift()!);
    } else {
      sourceKeys.splice(idx % sourceKeys.length, 1);
      continue;
    }
    idx++;
  }

  return result;
}

// ---- GET /api/feed ----
// Serves frozen daily issues.
//   GET /api/feed          → today's issue
//   GET /api/feed?issue=N  → archive issue #N
// Empty state: { issue: null, items: [] } (HTTP 200)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Vercel cron uses GET — route ?cron=1 to the refresh handler
  if (searchParams.get("cron") === "1") {
    return handleCronRefresh(req);
  }

  // Lightweight poll: just the latest published issue number.
  // Uncached so midnight drops are visible immediately (the full feed
  // response is CDN-cached for an hour and must not be used for polling).
  if (searchParams.get("latest") === "1") {
    const supabase = await createClient();
    const { data: latestRow } = await supabase
      .from("issues")
      .select("issue_number")
      .eq("published", true)
      .order("issue_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    return NextResponse.json(
      { latestNumber: latestRow?.issue_number ?? 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = await createClient();
  const issueParam = searchParams.get("issue");

  const todayEST = estDateString(); // "YYYY-MM-DD" in EST

  // 1. Resolve the issue
  let issueQuery = supabase
    .from("issues")
    .select("id, issue_number, date, origin, published");

  if (issueParam) {
    const issueNumber = parseFloat(issueParam);
    if (isNaN(issueNumber)) {
      return NextResponse.json({ issue: null, items: [] }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      });
    }
    issueQuery = issueQuery.eq("issue_number", issueNumber);
  } else {
    // Default: most recent published issue (survives midnight UTC rollover)
    issueQuery = issueQuery
      .eq("published", true)
      .order("date", { ascending: false })
      .limit(1);
  }

  const { data: issue } = await issueQuery.maybeSingle();

  if (!issue) {
    return NextResponse.json({ issue: null, items: [], latestNumber: 0 }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  }

  // 1b. Query the latest published issue number (for forward navigation bar)
  const { data: latestRow } = await supabase
    .from("issues")
    .select("issue_number")
    .eq("published", true)
    .order("issue_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestNumber = latestRow?.issue_number ?? issue.issue_number ?? 0;

  // 2. Load issue articles ordered by position, join articles + sources
  const { data: issueRows } = await supabase
    .from("issue_articles")
    .select(
      `position,
       article_id,
       articles!inner(
         id, title, link, pub_date, content_snippet, content, image, source_id,
         sources!inner(id, title, feed_url, site_url)
       )`,
    )
    .eq("issue_id", issue.id)
    .order("position");

  // 3. Build items list
  const items: Omit<FeedItem, "tags">[] = [];
  const links: string[] = [];
  const sourceIdSet = new Set<string>();

  for (const row of issueRows ?? []) {
    const a = (row as any).articles;
    const s = a?.sources;
    const link: string | undefined = a?.link;
    if (!link) continue;

    items.push({
      articleId: a.id,
      position: row.position,
      title: a.title ?? "",
      link,
      pubDate: a.pub_date,
      sourceTitle: s?.title || "Unknown",
      sourceUrl: s?.site_url || "",
      sourceId: a.source_id || s?.id || "",
      image: a.image ?? undefined,
      contentSnippet: a.content_snippet ?? "",
      content: a.content ?? "",
    });

    links.push(link);
    if (a.source_id) sourceIdSet.add(a.source_id);
  }

  if (!items.length) {
    return NextResponse.json({
      issue: {
        number: issue.issue_number,
        date: issue.date,
        count: 0,
        origin: issue.origin,
        isToday: issue.date === todayEST,
        published: issue.published,
      },
      items: [],
      latestNumber,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  }

  // 4. Attach tags (article_tags + source_tags merged, deduped by id)
  const uniqueSourceIds = [...sourceIdSet];

  const [articleTagRes, sourceTagRes] = await Promise.all([
    supabase
      .from("article_tags")
      .select("tag_id, articles!inner(link), tags(id, name, slug, facet)")
      .in("articles.link", links),
    supabase
      .from("source_tags")
      .select("source_id, tag_id, tags(id, name, slug, facet)")
      .in("source_id", uniqueSourceIds),
  ]);

  const sourceTagMap = new Map<string, Tag[]>();
  for (const st of sourceTagRes.data ?? []) {
    if (!sourceTagMap.has(st.source_id)) sourceTagMap.set(st.source_id, []);
    sourceTagMap.get(st.source_id)!.push(st.tags as any);
  }

  const keywordTagMap = new Map<string, Tag[]>();
  for (const at of articleTagRes.data ?? []) {
    const atLink = (at.articles as any)?.link;
    if (!atLink) continue;
    if (!keywordTagMap.has(atLink)) keywordTagMap.set(atLink, []);
    keywordTagMap.get(atLink)!.push(at.tags as any);
  }

  const withTags: FeedItem[] = items.map((item) => {
    const keyword = keywordTagMap.get(item.link) ?? [];
    const inherited = sourceTagMap.get(item.sourceId) ?? [];
    const seen = new Set<string>();
    const merged: Tag[] = [];
    for (const t of [...keyword, ...inherited]) {
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        merged.push(t);
      }
    }
    return { ...item, tags: merged };
  });

  // 5. Respond
  return NextResponse.json({
    issue: {
      number: issue.issue_number,
      date: issue.date,
      count: withTags.length,
      origin: issue.origin,
      isToday: issue.date === todayEST,
      published: issue.published,
    } satisfies IssueResponse,
    items: withTags,
    latestNumber,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}

// ---- POST /api/feed ---- (and GET ?cron=1)
// Cron-triggered RSS refresh. Vercel Cron hits GET, but POST is also supported.

async function handleCronRefresh(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createClient();

  const { data: sources, error } = await supabase
    .from("sources")
    .select("id, feed_url, last_fetched_at")
    .eq("hidden", false);

  if (error || !sources?.length) {
    return NextResponse.json({ refreshed: 0 });
  }

  // Filter out blacklisted feed URLs (use service client since RLS blocks user reads)
  const serviceClient = createServiceClient();
  const { data: blacklisted } = await serviceClient
    .from("blacklisted_feeds")
    .select("feed_url");

  const blacklistedUrls = new Set(
    (blacklisted ?? []).map((b: any) => b.feed_url),
  );
  const toRefresh = sources.filter((s) => !blacklistedUrls.has(s.feed_url));

  await refreshStaleSources(toRefresh);

  return NextResponse.json({ refreshed: sources.length });
}

export async function POST(req: Request) {
  return handleCronRefresh(req);
}
