import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership via collection -> curator -> user
  const { data: source } = await supabase
    .from("sources")
    .select("id, collection_id, collections!inner(curator_id, curators!inner(user_id))")
    .eq("id", id)
    .single();

  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify the source belongs to the authenticated user
  const ownerUserId = (source as any).collections?.curators?.user_id;
  if (ownerUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("sources").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
