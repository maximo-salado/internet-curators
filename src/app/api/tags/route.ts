import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const facet = searchParams.get("facet");

  let query = supabase
    .from("tags")
    .select("id, name, slug, facet, parent_id, display_order")
    .order("facet")
    .order("display_order");

  if (facet) {
    query = query.eq("facet", facet);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const grouped: Record<string, typeof data> = {};
  for (const tag of data ?? []) {
    if (!grouped[tag.facet]) grouped[tag.facet] = [];
    grouped[tag.facet].push(tag);
  }

  return NextResponse.json({ tags: data, grouped });
}
