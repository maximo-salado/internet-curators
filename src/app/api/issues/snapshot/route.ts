import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

interface ArticleRow {
  id: string;
  link: string;
  pub_date: string;
  source_id: string;
}

interface SourceRow {
  id: string;
  feed_url: string;
  title: string;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10); // yyyy-mm-dd
}

async function snapshotLogic() {
  const supabase = createServiceClient();

  // 1. Compute today's UTC date
  const p_date = formatDate(new Date());

  // 2. Get blacklisted feed URLs
  const { data: blacklisted } = await supabase
    .from("blacklisted_feeds")
    .select("feed_url");
  const blacklistedUrls = new Set((blacklisted ?? []).map((b: any) => b.feed_url));

  // 3. Get eligible sources (hidden = false, not blacklisted)
  const { data: sources } = await supabase
    .from("sources")
    .select("id, feed_url, title")
    .eq("hidden", false);

  const eligibleSources = (sources ?? []).filter(
    (s) => !blacklistedUrls.has(s.feed_url)
  );

  if (!eligibleSources.length) {
    return NextResponse.json({ created: false, reason: "empty_pool" });
  }

  const eligibleSourceMap = new Map<string, SourceRow>();
  const eligibleSourceIds: string[] = [];
  for (const s of eligibleSources) {
    eligibleSourceMap.set(s.id, s);
    eligibleSourceIds.push(s.id);
  }

  // 4. Get already-issued article links for exclusion
  const { data: issuedArticles } = await supabase
    .from("issue_articles")
    .select("article_id, articles(link)");

  const issuedLinkSet = new Set<string>();
  for (const row of (issuedArticles ?? [])) {
    const articles = row.articles as any;
    if (articles?.link) issuedLinkSet.add(articles.link);
  }

  // 5. Get eligible articles from eligible sources, newest-first
  const { data: articles } = await supabase
    .from("articles")
    .select("id, link, pub_date, source_id")
    .in("source_id", eligibleSourceIds)
    .order("pub_date", { ascending: false })
    .limit(500);

  if (!articles?.length) {
    return NextResponse.json({ created: false, reason: "empty_pool" });
  }

  // 6. Filter out already-issued articles, dedup by link (keep newest pub_date)
  const seen = new Map<string, ArticleRow>();
  for (const a of articles) {
    if (issuedLinkSet.has(a.link)) continue;
    if (!seen.has(a.link)) {
      seen.set(a.link, a as ArticleRow);
    }
    // Since articles are newest-first, first seen = newest. Skip duplicates.
  }

  // Filter to eligible sources only (in case source wasn't in our map)
  const eligible: ArticleRow[] = [];
  for (const a of seen.values()) {
    if (eligibleSourceMap.has(a.source_id)) {
      eligible.push(a);
    }
  }

  if (!eligible.length) {
    return NextResponse.json({ created: false, reason: "empty_pool" });
  }

  // 7. Interleave by source (round-robin) so no source dominates
  const bySource = new Map<string, ArticleRow[]>();
  for (const item of eligible) {
    const key = item.source_id;
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key)!.push(item);
  }

  const sourceKeys = Array.from(bySource.keys());
  const interleaved: ArticleRow[] = [];
  let idx = 0;
  while (interleaved.length < 20 && sourceKeys.length > 0) {
    const sourceKey = sourceKeys[idx % sourceKeys.length];
    const bucket = bySource.get(sourceKey)!;
    if (bucket.length > 0) {
      interleaved.push(bucket.shift()!);
    } else {
      sourceKeys.splice(idx % sourceKeys.length, 1);
      continue;
    }
    idx++;
  }

  // 8. Take up to 20, extract article IDs in order
  const p_article_ids = interleaved.map((a) => a.id);

  if (!p_article_ids.length) {
    return NextResponse.json({ created: false, reason: "empty_pool" });
  }

  // 9. Call RPC to create the daily issue atomically
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "create_daily_issue",
    {
      p_date,
      p_origin: "auto",
      p_article_ids,
    }
  );

  if (rpcError) {
    // 23505 = unique_violation — date already has an issue (idempotent)
    if (rpcError.code === "23505") {
      const { data: existing } = await supabase
        .from("issues")
        .select("issue_number, date")
        .eq("date", p_date)
        .single();

      return NextResponse.json({
        created: false,
        issueNumber: existing?.issue_number ?? null,
        date: existing?.date ?? p_date,
      });
    }

    // "empty_pool" raised by the function — should not happen since we check,
    // but handle gracefully
    if (
      rpcError.message?.includes("empty_pool") ||
      rpcError.details?.includes("empty_pool")
    ) {
      return NextResponse.json({ created: false, reason: "empty_pool" });
    }

    // Unexpected error
    console.error("create_daily_issue RPC error:", rpcError);
    return NextResponse.json(
      { error: "Failed to create daily issue", details: rpcError.message },
      { status: 500 }
    );
  }

  // 10. Success
  const result = (rpcData as any[])?.[0] ?? rpcData;
  const issueNumber = result?.issue_number;
  const date = p_date;

  return NextResponse.json({
    created: true,
    issueNumber,
    date,
    count: p_article_ids.length,
  });
}

// Vercel Cron uses GET by default
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const isCron = searchParams.get("cron") === "1";

  if (!isCron) {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  // Require auth for cron GET calls too
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return snapshotLogic();
}

// Direct POST — triggered by cron job or manual call
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return snapshotLogic();
}
