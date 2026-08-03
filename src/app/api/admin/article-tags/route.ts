import { requireEditor } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = await requireEditor();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabase } = auth;
  const { searchParams } = new URL(req.url);

  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));
  const sourceId = searchParams.get("source_id");

  let query = supabase
    .from("article_tags")
    .select(`
      article_id,
      tag_id,
      articles!inner(id, title, link, source_id, pub_date),
      tags!inner(id, name, slug, facet)
    `)
    .order("pub_date", { foreignTable: "articles", ascending: false })
    .limit(limit);

  if (sourceId) {
    query = query.eq("articles.source_id", sourceId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
