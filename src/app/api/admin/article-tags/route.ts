import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: curator } = await supabase
    .from("curators")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (curator?.role !== "editor") {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

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
