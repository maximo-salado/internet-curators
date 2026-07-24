import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET — user's saved articles with full article + source data
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to view saved articles" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

  // Get saved article IDs, newest first
  const { data: savedActions, error } = await supabase
    .from("user_article_actions")
    .select("article_id, created_at")
    .eq("user_id", user.id)
    .eq("action", "save")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !savedActions?.length) {
    return NextResponse.json({ items: [], total: 0, hasMore: false });
  }

  const articleIds = savedActions.map((a) => a.article_id);

  // Count total for pagination
  const { count: total } = await supabase
    .from("user_article_actions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("action", "save");

  // Fetch full article data
  const { data: articles } = await supabase
    .from("articles")
    .select(`
      id, title, link, pub_date, content_snippet, image, source_id,
      sources(id, title, site_url)
    `)
    .in("id", articleIds);

  if (!articles?.length) {
    return NextResponse.json({ items: [], total: 0, hasMore: false });
  }

  // Fetch vote counts
  const links = articles.map((a) => a.link);
  const { data: votes } = await supabase
    .from("article_votes")
    .select("link, upvotes, downvotes")
    .in("link", links);

  const voteMap = new Map<string, { upvotes: number; downvotes: number }>();
  for (const v of votes ?? []) {
    voteMap.set(v.link, { upvotes: v.upvotes, downvotes: v.downvotes });
  }

  // Preserve saved order (most recently saved first)
  const items = [];
  for (const saved of savedActions) {
    const article = articles.find((a) => a.id === saved.article_id);
    if (!article) continue;
    const source = (article as any).sources;
    items.push({
      id: article.id,
      title: article.title,
      link: article.link,
      pubDate: article.pub_date,
      contentSnippet: article.content_snippet,
      image: article.image,
      sourceTitle: source?.title ?? "Unknown",
      sourceId: article.source_id,
      sourceUrl: source?.site_url ?? "",
      upvotes: voteMap.get(article.link)?.upvotes ?? 0,
      downvotes: voteMap.get(article.link)?.downvotes ?? 0,
    });
  }

  return NextResponse.json({
    items,
    total: total ?? 0,
    hasMore: offset + limit < (total ?? 0),
  });
}
