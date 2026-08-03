import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export interface IssueSummary {
  number: number;
  date: string;
  count: number;
  leadImage: string | null;
}

export async function GET() {
  const supabase = await createClient();

  const { data: issues, error } = await supabase
    .from("issues")
    .select("id, issue_number, date")
    .eq("published", true)
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!issues || issues.length === 0) {
    return NextResponse.json(
      { issues: [] },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  }

  const issueIds = issues.map((i) => i.id);

  const [countsResult, imagesResult] = await Promise.all([
    supabase.from("issue_articles").select("issue_id").in("issue_id", issueIds),
    supabase
      .from("issue_articles")
      .select("issue_id, articles(image)")
      .in("issue_id", issueIds)
      .order("position", { ascending: true }),
  ]);

  const countMap = new Map<string, number>();
  for (const row of countsResult.data ?? []) {
    countMap.set(row.issue_id, (countMap.get(row.issue_id) ?? 0) + 1);
  }

  // Cover = the first article (by position) that actually has an image, so an
  // image-less lead article doesn't leave the whole issue without a cover.
  const imageMap = new Map<string, string>();
  for (const row of imagesResult.data ?? []) {
    if (imageMap.has(row.issue_id)) continue;
    const articles = row.articles as { image?: string } | null;
    if (articles?.image) imageMap.set(row.issue_id, articles.image);
  }

  const result: IssueSummary[] = issues.map((issue) => ({
    number: issue.issue_number,
    date: issue.date,
    count: countMap.get(issue.id) ?? 0,
    leadImage: imageMap.get(issue.id) ?? null,
  }));

  return NextResponse.json(
    { issues: result },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}
