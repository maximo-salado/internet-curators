import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

  // Check if user is an editor
  let isEditor = false;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: curator } = await supabase
      .from("curators")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (curator?.role === "editor") isEditor = true;
  }

  // Always query discovered_sources — rejected_sources is only for dedup/blacklist
  const { data, error, count } = await supabase
    .from("discovered_sources")
    .select("*", { count: "exact" })
    .eq("status", status)
    .order("discovered_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    items: data ?? [],
    total: count ?? 0,
    hasMore: (count ?? 0) > offset + limit,
    isEditor,
  });
}
