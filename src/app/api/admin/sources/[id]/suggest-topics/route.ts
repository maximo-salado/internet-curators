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

type ScoredTag = { id: string; name: string; slug: string; score: number };

// Regex for extracting content from meta tags of interest
const META_TAG_RE =
  /<meta\s+(?:property|name)\s*=\s*["'](article:tag|keywords|news_keywords|article:section)["']\s+content\s*=\s*["']([^"']+)["']/gi;

/**
 * Fetch and parse meta tags from a source's homepage HTML.
 * Returns an array of cleaned keyword tokens.
 */
async function extractMetaKeywords(homepageUrl: string): Promise<string[]> {
  const keywords: string[] = [];

  try {
    const res = await fetch(homepageUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "InternetCurators/1.0 (meta-tag-scanner)",
        Accept: "text/html, */*",
      },
    });

    if (!res.ok) return keywords;

    const html = await res.text();

    // Extract up to first 200 KB to avoid huge pages
    const window = html.slice(0, 200_000);

    let match: RegExpExecArray | null;
    // Reset lastIndex since we're using the global flag
    META_TAG_RE.lastIndex = 0;
    while ((match = META_TAG_RE.exec(window)) !== null) {
      const content = match[2];
      if (!content) continue;

      // Split by commas, clean, lowercase
      const tokens = content
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      keywords.push(...tokens);
    }
  } catch {
    // Silently ignore fetch/parse failures — meta tags are supplementary
  }

  return keywords;
}

/**
 * Score extracted meta keywords against the topic taxonomy tags.
 * Uses a 0.5x multiplier relative to article-content matching.
 */
function scoreMetaMatches(
  metaKeywords: string[],
  topicTags: Array<{ id: string; name: string; slug: string; keywords: string[] | null }>,
): ScoredTag[] {
  if (metaKeywords.length === 0) return [];

  const results: ScoredTag[] = [];

  for (const tag of topicTags) {
    const tagKeywords = tag.keywords ?? [];
    if (tagKeywords.length === 0) continue;

    let score = 0;

    for (const mk of metaKeywords) {
      // Exact or LIKE match against tag name/slug/keywords
      const tagNameLower = tag.name.toLowerCase();
      const tagSlugLower = tag.slug.toLowerCase();

      // Direct match against tag name or slug
      if (mk === tagNameLower || mk === tagSlugLower || mk === tagSlugLower.replace(/-/g, " ")) {
        score += 2;
        continue;
      }

      // Substring match against tag name
      if (tagNameLower.includes(mk) || mk.includes(tagNameLower)) {
        score += 1;
        continue;
      }

      // Match against tag keywords
      for (const tk of tagKeywords) {
        const tkClean = tk.toLowerCase().trim();
        if (!tkClean) continue;
        if (mk === tkClean || mk.includes(tkClean) || tkClean.includes(mk)) {
          score += 1;
          break;
        }
      }
    }

    if (score > 0) {
      // 0.5x multiplier: meta tags are a weaker signal than article content
      results.push({ id: tag.id, name: tag.name, slug: tag.slug, score: Math.ceil(score * 0.5) });
    }
  }

  return results;
}

// ── Types for source lookup ─────────────────────────

type SourceRecord = {
  id: string;
  feed_url: string | null;
  site_url: string | null;
  sourceTable: "sources" | "discovered_sources";
};

async function lookupSource(supabase: Awaited<ReturnType<typeof createClient>>, id: string): Promise<SourceRecord | null> {
  // 1. Try the approved sources table first — most admin sources live here
  const { data: approved, error: approvedErr } = await supabase
    .from("sources")
    .select("id, feed_url, site_url")
    .eq("id", id)
    .single();

  if (!approvedErr && approved) {
    return { ...approved, sourceTable: "sources" };
  }

  // 2. Fall back to discovered_sources (not yet approved)
  const { data: discovered, error: discoveredErr } = await supabase
    .from("discovered_sources")
    .select("id, feed_url, site_url")
    .eq("id", id)
    .single();

  if (!discoveredErr && discovered) {
    return { ...discovered, sourceTable: "discovered_sources" };
  }

  return null;
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

  // 1. Look up the source: approved table first, discovered table as fallback
  const source = await lookupSource(supabase, id);

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const isApproved = source.sourceTable === "sources";

  console.log(
    "[DEBUG suggest-topics] Source found:",
    JSON.stringify({
      id: source.id,
      table: source.sourceTable,
      feed_url: source.feed_url,
      site_url: source.site_url,
    })
  );

  // ── Cross-reference: discovered_sources may have an approved counterpart in `sources`
  //     Articles are linked to `sources.id`, so we must use the approved source ID
  //     when querying articles and source_tags.
  let approvedSourceId: string | null = null;
  if (!isApproved && source.feed_url) {
    const { data: approvedByFeed } = await supabase
      .from("sources")
      .select("id")
      .eq("feed_url", source.feed_url)
      .limit(1)
      .maybeSingle();

    if (approvedByFeed) {
      approvedSourceId = approvedByFeed.id;
      console.log(
        `[DEBUG suggest-topics] Cross-referenced approved source by feed_url: ${approvedSourceId}`
      );
    }
  }

  // Resolve the ID to use for article queries (approved source ID if cross-referenced)
  const articleSourceId = approvedSourceId ?? source.id;

  // 2. Collect text corpus from articles
  const corpusParts: string[] = [];
  let articlesFetched = false;

  const { data: articles } = await supabase
    .from("articles")
    .select("title, content_snippet")
    .eq("source_id", articleSourceId)
    .order("pub_date", { ascending: false })
    .limit(20);

  if (articles && articles.length > 0) {
    articlesFetched = true;
    console.log(`[DEBUG suggest-topics] Articles found: ${articles.length}`);
    for (const a of articles) {
      if (a.title) corpusParts.push(a.title);
      if (a.content_snippet) corpusParts.push(a.content_snippet);
    }
  }

  // Fall back to recent_posts for discovered sources without articles
  if (!articlesFetched && !isApproved) {
    const { data: discoveredWithPosts } = await supabase
      .from("discovered_sources")
      .select("recent_posts")
      .eq("id", source.id)
      .single();

    const recentPosts = (discoveredWithPosts?.recent_posts as Array<{ title?: string }>) ?? [];
    for (const rp of recentPosts) {
      if (rp.title) corpusParts.push(rp.title);
    }
  }

  const corpus = corpusParts.join(" ");

  console.log(
    `[DEBUG suggest-topics] Corpus length: ${corpus.length}, first 200 chars:`,
    corpus.slice(0, 200)
  );

  // 3. Get all taxonomy tags (topic, voice, stance) with keywords
  const { data: topicTags, error: tagsErr } = await supabase
    .from("tags")
    .select("id, name, slug, keywords")
    .in("facet", ["topic", "voice", "stance"]);

  if (tagsErr) {
    return NextResponse.json({ error: tagsErr.message }, { status: 500 });
  }

  console.log(
    `[DEBUG suggest-topics] Taxonomy tags fetched: ${topicTags?.length ?? 0} total, ` +
      `${topicTags?.filter((t) => (t.keywords as string[] | null)?.length).length ?? 0} have keywords`
  );

  // 4. Score each topic tag against the corpus
  const scored: ScoredTag[] = [];

  for (const tag of topicTags ?? []) {
    const keywords = (tag.keywords as string[]) ?? [];
    if (keywords.length === 0) continue;

    const score = countKeywordHits(corpus, keywords);
    if (score > 0) {
      scored.push({ id: tag.id, name: tag.name, slug: tag.slug, score });
    }
  }

  console.log(
    `[DEBUG suggest-topics] Scored tags before meta-tag supplement: ${scored.length}`
  );

  // 5. If article content yielded fewer than 5 suggestions and the source has
  //    a site_url, supplement with meta tag parsing from the homepage.
  const scoredBeforeMeta = scored.length;
  const META_FETCH_THRESHOLD = 5;
  let metaKeywordsCount: number | string = "skipped";
  if (scored.length < META_FETCH_THRESHOLD && source.site_url) {
    const homepageUrl = source.site_url.startsWith("http")
      ? source.site_url
      : `https://${source.site_url}`;

    const metaKeywords = await extractMetaKeywords(homepageUrl);
    metaKeywordsCount = metaKeywords.length;

    if (metaKeywords.length > 0) {
      const topicTagsWithKeywords = (topicTags ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        keywords: (t.keywords as string[]) ?? [],
      }));

      const metaScored = scoreMetaMatches(metaKeywords, topicTagsWithKeywords);

      // Merge meta suggestions into scored, deduping by tag ID
      for (const ms of metaScored) {
        const existing = scored.find((s) => s.id === ms.id);
        if (existing) {
          // Boost existing score by the meta contribution
          existing.score += ms.score;
        } else {
          scored.push(ms);
        }
      }
    }
  }

  // Sort by score descending, cap at 10
  scored.sort((a, b) => b.score - a.score);
  const suggested = scored.slice(0, 10);

  // 6. Get current topic tags for this source — use the correct junction table
  //    If we cross-referenced an approved source, use source_tags with that ID
  const hasApprovedCounterpart = approvedSourceId !== null;
  const junctionTable = (isApproved || hasApprovedCounterpart) ? "source_tags" : "discovered_source_tags";
  const tagSourceId = approvedSourceId ?? source.id;

  const { data: currentTagRows } = await supabase
    .from(junctionTable)
    .select("tag_id, tags!inner(id, name, facet)")
    .eq("source_id", tagSourceId);

  const current = (currentTagRows ?? [])
    .filter((r: any) => ["topic", "voice", "stance"].includes(r.tags?.facet))
    .map((r: any) => ({ id: r.tags.id, name: r.tags.name }));

  console.log(
    `[DEBUG suggest-topics] Final suggested array length: ${suggested.length}`
  );

  // ── Build _debug object ───────────────────────────────
  const tagsArr = (topicTags ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    keywords: string[] | null;
  }>;
  const tagsWithKeywords = tagsArr.filter(
    (t) => (t.keywords as string[] | null)?.length
  );

  const _debug = {
    sourceFound: true,
    sourceTable: source.sourceTable,
    approvedSourceId: approvedSourceId,
    articleSourceId: articleSourceId,
    articlesCount: articles?.length ?? 0,
    corpusLength: corpus.length,
    corpusPreview: corpus.slice(0, 100),
    taxonomyTagsTotal: tagsArr.length,
    taxonomyTagsWithKeywords: tagsWithKeywords.length,
    first3TagNames: tagsWithKeywords.slice(0, 3).map((t) => ({
      name: t.name,
      keywordCount: (t.keywords as string[]).length,
    })),
    scoredBeforeMeta,
    metaKeywordsCount,
  };

  return NextResponse.json({ suggested, current, _debug });
}
