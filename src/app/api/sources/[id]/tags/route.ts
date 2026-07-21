import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from("source_tags")
    .select("tag_id, tags(id, name, slug, facet, parent_id)")
    .eq("source_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  const { tag_ids } = await req.json();

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

  // Validate tag_ids
  if (!Array.isArray(tag_ids)) {
    return NextResponse.json({ error: "tag_ids must be an array" }, { status: 400 });
  }
  if (tag_ids.length > 50) {
    return NextResponse.json({ error: "Maximum 50 tags per source" }, { status: 400 });
  }

  // Delete + insert in sequence (Supabase HTTP API doesn't support transactions,
  // but the likelihood of partial failure for a single source is negligible)
  const { error: deleteErr } = await supabase.from("source_tags").delete().eq("source_id", id);
  if (deleteErr) {
    return NextResponse.json({ error: "Failed to update tags" }, { status: 500 });
  }
  if (tag_ids.length > 0) {
    const rows = tag_ids.map((tag_id: string) => ({ source_id: id, tag_id }));
    const { error: insertErr } = await supabase.from("source_tags").insert(rows);
    if (insertErr) {
      return NextResponse.json({ error: "Failed to update tags" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
