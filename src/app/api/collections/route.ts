import { createClient } from "@/lib/supabase/server";
import { ensureCurator, generateSlug } from "@/lib/db-helpers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description = "", published = false } = await req.json();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const displayName = user.email?.split("@")[0] ?? "Curator";
  const curator = await ensureCurator(user.id, displayName);

  const slug = await generateSlug(name);

  const { data, error } = await supabase
    .from("collections")
    .insert({ curator_id: curator.id, name, description, slug, published })
    .select("id, name, description, slug, published, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: curator } = await supabase
    .from("curators")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!curator) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("collections")
    .select("id, name, description, slug, published, created_at")
    .eq("curator_id", curator.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, published } = await req.json();
  if (!id) return NextResponse.json({ error: "Collection ID required" }, { status: 400 });

  // Verify ownership
  const { data: curator } = await supabase
    .from("curators")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!curator) return NextResponse.json({ error: "Not a curator" }, { status: 403 });

  const { error } = await supabase
    .from("collections")
    .update({ published })
    .eq("id", id)
    .eq("curator_id", curator.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
