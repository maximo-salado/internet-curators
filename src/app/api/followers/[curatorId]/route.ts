import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ curatorId: string }> }
) {
  const { curatorId } = await params;
  const supabase = await createClient();

  // Upsert follower count
  const { data: existing } = await supabase
    .from("follower_counts")
    .select("count")
    .eq("curator_id", curatorId)
    .single();

  if (existing) {
    await supabase
      .from("follower_counts")
      .update({ count: existing.count + 1 })
      .eq("curator_id", curatorId);
  } else {
    await supabase
      .from("follower_counts")
      .insert({ curator_id: curatorId, count: 1 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ curatorId: string }> }
) {
  const { curatorId } = await params;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("follower_counts")
    .select("count")
    .eq("curator_id", curatorId)
    .single();

  if (existing && existing.count > 0) {
    await supabase
      .from("follower_counts")
      .update({ count: existing.count - 1 })
      .eq("curator_id", curatorId);
  }

  return NextResponse.json({ success: true });
}
