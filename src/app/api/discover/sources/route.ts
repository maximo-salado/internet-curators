import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

  // Check if user is an editor
  let isEditor = false;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: curator } = await supabase
      .from("curators")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (curator?.role === "editor") isEditor = true;
  }

  // Fetch discovered sources
  const { data, error, count } = await supabase
    .from("discovered_sources")
    .select("*", { count: "exact" })
    .eq("status", status)
    .order("discovered_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sources = data ?? [];

  // Fetch tags for all returned sources
  if (sources.length > 0) {
    const sourceIds = sources.map((s) => s.id);
    const { data: tagRows } = await supabase
      .from("discovered_source_tags")
      .select("source_id, tag_id, tags!inner(slug, name, facet)")
      .in("source_id", sourceIds);

    // Merge tags into each source
    const tagsBySource = new Map<string, Array<{ slug: string; name: string; facet: string }>>();
    for (const row of (tagRows ?? [])) {
      const tag = (row as any).tags;
      if (!tag) continue;
      const list = tagsBySource.get(row.source_id) ?? [];
      list.push({ slug: tag.slug, name: tag.name, facet: tag.facet });
      tagsBySource.set(row.source_id, list);
    }

    for (const source of sources) {
      (source as any).tags = tagsBySource.get(source.id) ?? [];
    }
  }

  return NextResponse.json({
    items: sources,
    total: count ?? 0,
    hasMore: (count ?? 0) > offset + limit,
    isEditor,
  });
}
