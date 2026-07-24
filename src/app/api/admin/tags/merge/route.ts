import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = await createClient();

  let body: { sourceId: string; targetId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sourceId, targetId } = body;

  if (!sourceId || !targetId) {
    return NextResponse.json({ error: "sourceId and targetId are required" }, { status: 400 });
  }

  if (sourceId === targetId) {
    return NextResponse.json({ error: "sourceId and targetId must be different" }, { status: 400 });
  }

  // 1. Reassign article_tags
  const { data: articleTags } = await supabase
    .from("article_tags")
    .select("*")
    .eq("tag_id", sourceId);

  if (articleTags && articleTags.length > 0) {
    const rows = articleTags.map((r) => ({ article_id: r.article_id, tag_id: targetId }));
    await supabase
      .from("article_tags")
      .upsert(rows, { onConflict: "article_id,tag_id", ignoreDuplicates: true });
    await supabase
      .from("article_tags")
      .delete()
      .eq("tag_id", sourceId);
  }

  // 2. Reassign source_tags
  const { data: sourceTags } = await supabase
    .from("source_tags")
    .select("*")
    .eq("tag_id", sourceId);

  if (sourceTags && sourceTags.length > 0) {
    const rows = sourceTags.map((r) => ({ source_id: r.source_id, tag_id: targetId }));
    await supabase
      .from("source_tags")
      .upsert(rows, { onConflict: "source_id,tag_id", ignoreDuplicates: true });
    await supabase
      .from("source_tags")
      .delete()
      .eq("tag_id", sourceId);
  }

  // 3. Delete the source tag
  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("id", sourceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ merged: true, sourceId, targetId });
}
