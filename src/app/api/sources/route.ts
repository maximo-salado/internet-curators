import { createClient } from "@/lib/supabase/server";
import { ensureCurator, generateSlug } from "@/lib/db-helpers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { feedUrl, sourceTitle, sourceUrl } = await req.json();
  if (!feedUrl) return NextResponse.json({ error: "feedUrl required" }, { status: 400 });

  const displayName = user.email?.split("@")[0] ?? "Curator";
  const curator = await ensureCurator(user.id, displayName);

  // Find or create "Saved" collection
  const { data: existing } = await supabase
    .from("collections")
    .select("id")
    .eq("curator_id", curator.id)
    .eq("name", "Saved")
    .single();

  let collectionId: string;
  if (existing) {
    collectionId = existing.id;
  } else {
    const slug = await generateSlug("Saved");
    const { data: created } = await supabase
      .from("collections")
      .insert({ curator_id: curator.id, name: "Saved", slug, published: false })
      .select("id")
      .single();
    if (!created) return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
    collectionId = created.id;
  }

  // Check if source already exists in user's collections
  const { data: duplicate } = await supabase
    .from("sources")
    .select("id")
    .eq("feed_url", feedUrl)
    .eq("collection_id", collectionId)
    .single();

  if (duplicate) {
    return NextResponse.json({ added: false, message: "Already in your collection" });
  }

  const { error } = await supabase.from("sources").insert({
    collection_id: collectionId,
    feed_url: feedUrl,
    title: sourceTitle || "",
    site_url: sourceUrl || "",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ added: true });
}
