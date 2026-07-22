import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ curators: [], sources: [] });

  const { data: rows } = await supabase
    .from("user_follows")
    .select("id, curator_id, source_id, created_at")
    .eq("user_id", user.id);

  const curators = (rows ?? []).filter((r) => r.curator_id).map((r) => ({ id: r.id, curator_id: r.curator_id, created_at: r.created_at }));
  const sources = (rows ?? []).filter((r) => r.source_id).map((r) => ({ id: r.id, source_id: r.source_id, created_at: r.created_at }));

  return NextResponse.json({ curators, sources });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const curatorId = body.curator_id as string | undefined;
  const sourceId = body.source_id as string | undefined;

  if (!curatorId && !sourceId) {
    return NextResponse.json({ error: "curator_id or source_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_follows")
    .insert({
      user_id: user.id,
      curator_id: curatorId || null,
      source_id: sourceId || null,
    })
    .select("id, curator_id, source_id, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already following" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (curatorId) {
    await supabase.rpc("increment_follower_count", { p_curator_id: curatorId });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const curatorId = searchParams.get("curator_id");
  const sourceId = searchParams.get("source_id");

  if (!id && !curatorId && !sourceId) {
    return NextResponse.json({ error: "id, curator_id, or source_id required" }, { status: 400 });
  }

  let query = supabase.from("user_follows").select("id, curator_id, source_id").eq("user_id", user.id);
  if (id) query = query.eq("id", id);
  else if (curatorId) query = query.eq("curator_id", curatorId);
  else if (sourceId) query = query.eq("source_id", sourceId);

  const { data: follow } = await query.single();
  if (!follow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("id", follow.id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (follow.curator_id) {
    await supabase.rpc("decrement_follower_count", { p_curator_id: follow.curator_id });
  }

  return NextResponse.json({ success: true });
}
