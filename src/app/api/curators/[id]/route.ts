import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: curator, error } = await supabase
    .from("curators")
    .select("id, display_name, bio, created_at, follower_counts(count)")
    .eq("id", id)
    .single();

  if (error || !curator)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only return published collections for public profiles
  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, description, slug, published, created_at")
    .eq("curator_id", id)
    .eq("published", true)
    .order("created_at", { ascending: false });

  return NextResponse.json({ ...curator, collections });
}
