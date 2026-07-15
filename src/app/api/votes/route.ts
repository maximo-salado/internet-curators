import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const VALID_VOTE = new Set([-1, 0, 1]);

// POST — apply a vote transition (anonymous)
// Body: { link, prev: 1|-1|0, next: 1|-1|0 }
// prev = user's previous vote, next = user's new vote
export async function POST(req: Request) {
  const supabase = await createClient();
  const { link, prev, next } = await req.json();

  if (!link || prev == null || next == null) {
    return NextResponse.json({ error: "link, prev, and next required" }, { status: 400 });
  }

  if (!VALID_VOTE.has(prev) || !VALID_VOTE.has(next)) {
    return NextResponse.json({ error: "prev and next must be -1, 0, or 1" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("apply_vote", {
    p_link: link,
    p_prev: prev,
    p_next: next,
  });

  if (error) {
    if (error.message?.includes("article_not_found")) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Vote failed" }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    success: true,
    upvotes: row?.upvotes ?? 0,
    downvotes: row?.downvotes ?? 0,
  });
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
