import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { link, direction } = await req.json();

  if (!link || (direction !== 1 && direction !== -1)) {
    return NextResponse.json({ error: "link and direction (1 or -1) required" }, { status: 400 });
  }

  const column = direction === 1 ? "upvotes" : "downvotes";

  // Try update existing
  const { data: existing } = await supabase
    .from("article_votes")
    .select("upvotes, downvotes")
    .eq("link", link)
    .single();

  if (existing) {
    await supabase
      .from("article_votes")
      .update({ [column]: existing[column] + 1 })
      .eq("link", link);
  } else {
    await supabase
      .from("article_votes")
      .insert({ link, upvotes: direction === 1 ? 1 : 0, downvotes: direction === -1 ? 1 : 0 });
  }

  return NextResponse.json({ success: true });
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const links = searchParams.get("links")?.split(",") ?? [];

  if (links.length === 0) return NextResponse.json({});

  const { data } = await supabase
    .from("article_votes")
    .select("link, upvotes, downvotes")
    .in("link", links);

  const counts: Record<string, { upvotes: number; downvotes: number }> = {};
  for (const row of data ?? []) {
    counts[row.link] = { upvotes: row.upvotes, downvotes: row.downvotes };
  }

  return NextResponse.json(counts);
}
