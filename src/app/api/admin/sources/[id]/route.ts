import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = await createClient();

  let body: { hidden?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.hidden !== "boolean") {
    return NextResponse.json({ error: "hidden must be a boolean" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sources")
    .update({ hidden: body.hidden })
    .eq("id", id)
    .select("id, hidden")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  let blacklist = false;
  try {
    const body = await req.json();
    blacklist = body.blacklist === true;
  } catch { /* body is optional */ }

  const supabase = createServiceClient();

  // 1. Get feed_url before deletion (needed for blacklist)
  const { data: source, error: fetchErr } = await supabase
    .from("sources")
    .select("feed_url")
    .eq("id", id)
    .single();

  if (fetchErr || !source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  // 2. Optionally blacklist the URL
  if (blacklist) {
    await supabase
      .from("blacklisted_feeds")
      .upsert({ feed_url: source.feed_url }, { onConflict: "feed_url" });
  }

  // 3. Delete articles first (FK constraint)
  const { count: articlesRemoved } = await supabase
    .from("articles")
    .delete({ count: "exact" })
    .eq("source_id", id);

  // 4. Delete the source
  const { error: deleteErr } = await supabase
    .from("sources")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, articlesRemoved, blacklisted: blacklist });
}
