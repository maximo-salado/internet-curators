import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tags")
    .select("id, name, slug, facet, parent_id, display_order")
    .order("facet")
    .order("display_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const grouped: Record<string, typeof data> = {};
  for (const tag of data ?? []) {
    if (!grouped[tag.facet]) grouped[tag.facet] = [];
    grouped[tag.facet].push(tag);
  }

  return NextResponse.json({ tags: data, grouped });
}
