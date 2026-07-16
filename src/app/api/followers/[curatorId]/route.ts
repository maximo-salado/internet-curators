import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ curatorId: string }> }
) {
  const { curatorId } = await params;
  const supabase = await createClient();
  // Atomic upsert+increment — avoids read-then-write race
  await supabase.rpc("increment_follower_count", { p_curator_id: curatorId });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ curatorId: string }> }
) {
  const { curatorId } = await params;
  const supabase = await createClient();
  // Atomic decrement clamped to 0 in DB function
  await supabase.rpc("decrement_follower_count", { p_curator_id: curatorId });
  return NextResponse.json({ success: true });
}
