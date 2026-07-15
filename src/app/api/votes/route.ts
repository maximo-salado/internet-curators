import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST — apply a vote transition (anonymous)
// Body: { link, prev: 1|-1|0, next: 1|-1|0 }
// prev = user's previous vote, next = user's new vote
export async function POST(req: Request) {
  const supabase = await createClient();
  const { link, prev, next } = await req.json();

  if (!link || prev == null || next == null) {
    return NextResponse.json({ error: "link, prev, and next required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("article_votes")
    .select("upvotes, downvotes")
    .eq("link", link)
    .single();

  let upvotes = existing?.upvotes ?? 0;
  let downvotes = existing?.downvotes ?? 0;

  // Undo previous vote
  if (prev === 1) upvotes = Math.max(0, upvotes - 1);
  if (prev === -1) downvotes = Math.max(0, downvotes - 1);
  // Apply new vote
  if (next === 1) upvotes++;
  if (next === -1) downvotes++;

  if (existing) {
    await supabase.from("article_votes").update({ upvotes, downvotes }).eq("link", link);
  } else {
    await supabase.from("article_votes").insert({ link, upvotes, downvotes });
  }

  return NextResponse.json({ success: true, upvotes, downvotes });
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
