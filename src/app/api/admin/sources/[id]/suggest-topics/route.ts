import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

// ── Helpers ─────────────────────────────────────────

function countKeywordHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    // Match whole-word-ish: keyword as a standalone token or within hyphenated/compound words
    const clean = kw.toLowerCase().trim();
    if (!clean) continue;

    // Count non-overlapping occurrences
    let pos = 0;
    while ((pos = lower.indexOf(clean, pos)) !== -1) {
      score++;
      pos += clean.length;
    }
  }
  return score;
}

// ── GET /api/admin/sources/[id]/suggest-topics ─────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = await createClient();

  // 1. Fetch the discovered source
  const { data: source, error: sourceErr } = await supabase
    .from("discovered_sources")
    .select("id, feed_url, recent_posts")
    .eq("id", id)
    .single();

  if (sourceErr || !source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  // 2. Collect text corpus: try articles first, fall back to recent_posts
  const corpusParts: string[] = [];

  // Check if a matching sources row exists (source may have been approved before)
  const { data: approvedSource } = await supabase
    .from("sources")
    .select("id")
    .eq("feed_url", source.feed_url)
    .maybeSingle();

  let articlesFetched = false;
  if (approvedSource) {
    const { data: articles } = await supabase
      .from("articles")
      .select("title, content_snippet")
      .eq("source_id", approvedSource.id)
      .order("pub_date", { ascending: false })
      .limit(20);

    if (articles && articles.length > 0) {
      articlesFetched = true;
      for (const a of articles) {
        if (a.title) corpusParts.push(a.title);
        if (a.content_snippet) corpusParts.push(a.content_snippet);
      }
    }
  }

  // Fall back to recent_posts from discovered_sources
  if (!articlesFetched) {
    const recentPosts = (source.recent_posts as Array<{ title?: string }>) ?? [];
    for (const rp of recentPosts) {
      if (rp.title) corpusParts.push(rp.title);
    }
  }

  const corpus = corpusParts.join(" ");

  // 3. Get all topic tags with keywords
  const { data: topicTags, error: tagsErr } = await supabase
    .from("tags")
    .select("id, name, slug, keywords")
    .eq("facet", "topic");

  if (tagsErr) {
    return NextResponse.json({ error: tagsErr.message }, { status: 500 });
  }

  // 4. Score each topic tag against the corpus
  const scored: Array<{ id: string; name: string; slug: string; score: number }> = [];

  for (const tag of topicTags ?? []) {
    const keywords = (tag.keywords as string[]) ?? [];
    if (keywords.length === 0) continue;

    const score = countKeywordHits(corpus, keywords);
    if (score > 0) {
      scored.push({ id: tag.id, name: tag.name, slug: tag.slug, score });
    }
  }

  // Sort by score descending, cap at 10
  scored.sort((a, b) => b.score - a.score);
  const suggested = scored.slice(0, 10);

  // 5. Get current topic tags for this source
  const { data: currentTagRows } = await supabase
    .from("discovered_source_tags")
    .select("tag_id, tags!inner(id, name, facet)")
    .eq("source_id", id);

  const current = (currentTagRows ?? [])
    .filter((r: any) => r.tags?.facet === "topic")
    .map((r: any) => ({ id: r.tags.id, name: r.tags.name }));

  return NextResponse.json({ suggested, current });
}
