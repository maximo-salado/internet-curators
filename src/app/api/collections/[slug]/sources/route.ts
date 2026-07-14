import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get the collection and verify ownership
  const { data: collection } = await supabase
    .from("collections")
    .select("id, curator_id, curators!inner(user_id)")
    .eq("slug", slug)
    .single();

  if (!collection)
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });

  // Verify curator owns this collection
  const { data: curator } = await supabase
    .from("curators")
    .select("user_id")
    .eq("id", collection.curator_id)
    .single();

  if (!curator || curator.user_id !== user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { feed_url: feedUrl } = await req.json();
  if (!feedUrl) return NextResponse.json({ error: "feed_url is required" }, { status: 400 });

  // Basic URL validation
  try {
    new URL(feedUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Try to fetch and parse RSS to get title
  let title = "";
  let siteUrl = "";
  let description = "";
  try {
    const Parser = (await import("rss-parser")).default;
    const parser = new Parser();
    const feed = await parser.parseURL(feedUrl);
    title = feed.title ?? "";
    description = feed.description ?? "";
    siteUrl = feed.link ?? "";
  } catch {
    // Feed fetch failed — store anyway, will be skipped on fetch
  }

  const { data, error } = await supabase
    .from("sources")
    .insert({
      collection_id: collection.id,
      feed_url: feedUrl,
      title,
      site_url: siteUrl,
      description,
    })
    .select("id, feed_url, title, site_url, description, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
