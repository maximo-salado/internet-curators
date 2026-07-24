import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/sources/top?limit=10
// Returns top sources ordered by recent article count (last 30 days).
// Public endpoint — no auth required.
export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10) || 10));

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  // Count articles per source in the last 30 days, join source metadata
  const { data, error } = await supabase
    .from("articles")
    .select("source_id, sources!inner(id, title, site_url, description)")
    .gte("pub_date", since)
    .order("pub_date", { ascending: false });

  if (error || !data?.length) {
    return NextResponse.json({ sources: [] });
  }

  // Aggregate counts per source
  const sourceMap = new Map<
    string,
    { id: string; title: string; site_url: string; description?: string; count: number }
  >();

  for (const row of data) {
    const s = row.sources as any;
    if (!s?.id) continue;

    const existing = sourceMap.get(s.id);
    if (existing) {
      existing.count++;
    } else {
      sourceMap.set(s.id, {
        id: s.id,
        title: s.title ?? "Unknown",
        site_url: s.site_url ?? "",
        description: s.description ?? undefined,
        count: 1,
      });
    }
  }

  // Sort by count descending, take top N
  const sorted = Array.from(sourceMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ count: _, ...rest }) => rest);

  return NextResponse.json({ sources: sorted });
}
