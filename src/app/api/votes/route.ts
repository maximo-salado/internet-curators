import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST — record a vote (anonymous, no user tracking)
export async function POST(req: Request) {
  const supabase = await createClient();
  const { link, direction } = await req.json();

  if (!link || (direction !== 1 && direction !== -1)) {
    return NextResponse.json({ error: "link and direction (1 or -1) required" }, { status: 400 });
  }

  const column = direction === 1 ? "upvotes" : "downvotes";

  // Upsert: create row if not exists, increment the column
  const { error } = await supabase.rpc("increment_vote", {
    p_link: link,
    p_column: column,
  });

  if (error) {
    // Fallback if RPC not available — raw upsert
    const { data: existing } = await supabase
      .from("article_votes")
      .select("upvotes, downvotes")
      .eq("link", link)
      .single();

    if (existing) {
      await supabase
        .from("article_votes")
        .update({ [column]: (existing[column as keyof typeof existing] as number) + 1 })
        .eq("link", link);
    } else {
      await supabase
        .from("article_votes")
        .insert({ link, upvotes: direction === 1 ? 1 : 0, downvotes: direction === -1 ? 1 : 0 });
    }
  }

  return NextResponse.json({ success: true });
}

// GET — fetch vote counts for multiple links
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
