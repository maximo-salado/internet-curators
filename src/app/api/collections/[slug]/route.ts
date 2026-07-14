import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: collection, error } = await supabase
    .from("collections")
    .select("id, curator_id, name, description, slug, created_at, curators(display_name)")
    .eq("slug", slug)
    .single();

  if (error || !collection)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: sources } = await supabase
    .from("sources")
    .select("id, feed_url, site_url, title, description, created_at")
    .eq("collection_id", collection.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ ...collection, sources });
}
