import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const query = searchParams.get("q")?.toLowerCase() ?? "";
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);
  const targetDate = dateParam || new Date().toISOString().slice(0, 10);

  const supabase = await createClient();

  // 1. Get all article_ids already assigned to ANY issue
  const { data: issuedArticles } = await supabase
    .from("issue_articles")
    .select("article_id");

  const issuedIds = new Set((issuedArticles ?? []).map((ia: any) => ia.article_id));

  // 2. Get approved (non-hidden) sources
  const { data: approvedSources } = await supabase
    .from("sources")
    .select("id")
    .eq("hidden", false);

  const approvedSourceIds = new Set((approvedSources ?? []).map((s: any) => s.id));

  if (approvedSourceIds.size === 0) {
    return NextResponse.json({ articles: [] });
  }

  // 3. Get eligible articles from approved sources, newest first
  let supabaseQuery = supabase
    .from("articles")
    .select(`
      id,
      title,
      link,
      image,
      content_snippet,
      pub_date,
      source_id,
      sources (id, title)
    `)
    .in("source_id", Array.from(approvedSourceIds))
    .order("pub_date", { ascending: false })
    .limit(200);

  const { data: articles, error } = await supabaseQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 4. Filter out already-issued articles
  let eligible = (articles ?? []).filter((a: any) => !issuedIds.has(a.id));

  // 5. If query provided, filter by title
  if (query) {
    eligible = eligible.filter((a: any) =>
      a.title?.toLowerCase().includes(query)
    );
  }

  // 6. Format and paginate
  const formatted = eligible.slice(0, limit).map((a: any) => ({
    articleId: a.id,
    title: a.title ?? "",
    link: a.link ?? "",
    image: a.image ?? null,
    contentSnippet: a.content_snippet ?? "",
    pubDate: a.pub_date ?? null,
    sourceId: a.source_id ?? "",
    sourceTitle: a.sources?.title ?? "Unknown",
  }));

  return NextResponse.json({ articles: formatted, total: eligible.length });
}
