import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: tags } = await supabase
    .from("discovered_source_tags")
    .select("tag_id")
    .eq("source_id", id);

  const tag_ids = (tags ?? []).map((t: { tag_id: string }) => t.tag_id);

  return NextResponse.json({ tag_ids });
}
