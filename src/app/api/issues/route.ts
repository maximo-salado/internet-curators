import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface IssueResponse {
  number: number;
  date: string;
  count: number;
  leadImage: string | null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to query params required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: issues, error } = await supabase
    .from("issues")
    .select("id, issue_number, date, published")
    .eq("published", true)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!issues || issues.length === 0) {
    return NextResponse.json(
      { issues: [] },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  }

  const issueIds = issues.map((i) => i.id);

  const [countsResult, imagesResult] = await Promise.all([
    supabase.from("issue_articles").select("issue_id").in("issue_id", issueIds),
    supabase
      .from("issue_articles")
      .select("issue_id, articles(image)")
      .in("issue_id", issueIds)
      .order("position", { ascending: true })
      .limit(1, { foreignTable: "issue_articles" }),
  ]);

  const countMap = new Map<string, number>();
  for (const row of countsResult.data ?? []) {
    countMap.set(row.issue_id, (countMap.get(row.issue_id) ?? 0) + 1);
  }

  const imageMap = new Map<string, string | null>();
  for (const row of imagesResult.data ?? []) {
    if (!imageMap.has(row.issue_id)) {
      const articles = row.articles as { image?: string } | null;
      imageMap.set(row.issue_id, articles?.image ?? null);
    }
  }

  const result: IssueResponse[] = issues.map((issue) => ({
    number: issue.issue_number,
    date: issue.date,
    count: countMap.get(issue.id) ?? 0,
    leadImage: imageMap.get(issue.id) ?? null,
  }));

  return NextResponse.json(
    { issues: result },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
