import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");

  const supabase = await createClient();

  // Parse date or default to today UTC
  let targetDate: string;
  if (dateParam) {
    // Accept yyyy-mm-dd
    targetDate = dateParam;
  } else {
    targetDate = new Date().toISOString().slice(0, 10);
  }

  // 1. Get the issue for this date
  const { data: issue, error: issueError } = await supabase
    .from("issues")
    .select("id, issue_number, date, origin, published, created_at")
    .eq("date", targetDate)
    .single();

  if (issueError) {
    if (issueError.code === "PGRST116") {
      // No rows returned
      return NextResponse.json({ issue: null, articles: [] });
    }
    return NextResponse.json({ error: issueError.message }, { status: 500 });
  }

  // 2. Get articles for this issue, joined with articles + sources
  const { data: articles, error: articlesError } = await supabase
    .from("issue_articles")
    .select(`
      article_id,
      position,
      articles (
        id,
        title,
        link,
        image,
        content_snippet,
        pub_date,
        source_id,
        sources (id, title)
      )
    `)
    .eq("issue_id", issue.id)
    .order("position");

  if (articlesError) {
    return NextResponse.json({ error: articlesError.message }, { status: 500 });
  }

  // Flatten the nested structure
  const flattenedArticles = (articles ?? []).map((ia: any) => {
    const a = ia.articles;
    const s = a?.sources;
    return {
      articleId: ia.article_id,
      position: ia.position,
      title: a?.title ?? "",
      link: a?.link ?? "",
      image: a?.image ?? null,
      contentSnippet: a?.content_snippet ?? "",
      pubDate: a?.pub_date ?? null,
      sourceId: a?.source_id ?? "",
      sourceTitle: s?.title ?? "Unknown",
    };
  });

  return NextResponse.json({ issue, articles: flattenedArticles });
}

// ── PATCH: reorder, remove, add, publish ────────────────────────

export async function PATCH(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const targetDate = dateParam || new Date().toISOString().slice(0, 10);

  let body: {
    action: "reorder" | "remove" | "add" | "publish";
    articleId?: string;
    articleIds?: string[];
    position?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;
  if (!action || !["reorder", "remove", "add", "publish"].includes(action)) {
    return NextResponse.json(
      { error: "action must be one of: reorder, remove, add, publish" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Find today's issue
  const { data: issue, error: issueError } = await supabase
    .from("issues")
    .select("id, issue_number, date, origin, published")
    .eq("date", targetDate)
    .single();

  if (issueError) {
    if (issueError.code === "PGRST116") {
      return NextResponse.json(
        { error: "No issue exists for this date. It will be generated at midnight." },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: issueError.message }, { status: 500 });
  }

  const issueId = issue.id;

  if (action === "publish") {
    // Toggle published state
    const { error: updateErr } = await supabase
      .from("issues")
      .update({ published: !issue.published })
      .eq("id", issueId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      issue: { ...issue, published: !issue.published },
    });
  }

  if (action === "remove") {
    if (!body.articleId) {
      return NextResponse.json(
        { error: "articleId is required for remove action" },
        { status: 400 }
      );
    }

    // Remove the article from the issue
    const { error: deleteErr } = await supabase
      .from("issue_articles")
      .delete()
      .eq("issue_id", issueId)
      .eq("article_id", body.articleId);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // Re-number positions after removal
    await renumberPositions(supabase, issueId);

    // Mark as curated
    await supabase.from("issues").update({ origin: "curated" }).eq("id", issueId);
  }

  if (action === "add") {
    if (!body.articleId) {
      return NextResponse.json(
        { error: "articleId is required for add action" },
        { status: 400 }
      );
    }

    // Get current max position
    const { data: maxPos } = await supabase
      .from("issue_articles")
      .select("position")
      .eq("issue_id", issueId)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const newPosition = (maxPos?.position ?? -1) + 1;

    // Add the article
    const { error: insertErr } = await supabase
      .from("issue_articles")
      .insert({
        issue_id: issueId,
        article_id: body.articleId,
        position: body.position ?? newPosition,
      });

    if (insertErr) {
      if (insertErr.code === "23505") {
        // unique violation — article already in issue or already in another issue
        return NextResponse.json(
          { error: "Article is already in an issue" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Mark as curated
    await supabase.from("issues").update({ origin: "curated" }).eq("id", issueId);
  }

  if (action === "reorder") {
    if (!body.articleIds || !Array.isArray(body.articleIds)) {
      return NextResponse.json(
        { error: "articleIds array is required for reorder action" },
        { status: 400 }
      );
    }

    // Reorder: validate then delete all current positions, re-insert in new order.
    // Fetch existing article IDs first to guard against data loss if insert fails.

    const { data: existingRows } = await supabase
      .from("issue_articles")
      .select("article_id")
      .eq("issue_id", issueId);

    const existingIds = new Set(
      (existingRows ?? []).map((r: { article_id: string }) => r.article_id)
    );

    const requestedSet = new Set(body.articleIds);

    if (
      existingIds.size !== requestedSet.size ||
      !body.articleIds.every((id) => existingIds.has(id))
    ) {
      return NextResponse.json(
        { error: "Article IDs in reorder do not match current issue articles" },
        { status: 400 }
      );
    }

    const { error: deleteErr } = await supabase
      .from("issue_articles")
      .delete()
      .eq("issue_id", issueId);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    const rows = body.articleIds.map((articleId, idx) => ({
      issue_id: issueId,
      article_id: articleId,
      position: idx,
    }));

    const { error: insertErr } = await supabase
      .from("issue_articles")
      .insert(rows);

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Mark as curated
    await supabase.from("issues").update({ origin: "curated" }).eq("id", issueId);
  }

  // Return fresh data after mutation
  const { data: updatedArticles } = await supabase
    .from("issue_articles")
    .select(`
      article_id,
      position,
      articles (
        id,
        title,
        link,
        image,
        content_snippet,
        pub_date,
        source_id,
        sources (id, title)
      )
    `)
    .eq("issue_id", issueId)
    .order("position");

  const flattened = (updatedArticles ?? []).map((ia: any) => {
    const a = ia.articles;
    const s = a?.sources;
    return {
      articleId: ia.article_id,
      position: ia.position,
      title: a?.title ?? "",
      link: a?.link ?? "",
      image: a?.image ?? null,
      contentSnippet: a?.content_snippet ?? "",
      pubDate: a?.pub_date ?? null,
      sourceId: a?.source_id ?? "",
      sourceTitle: s?.title ?? "Unknown",
    };
  });

  const { data: updatedIssue } = await supabase
    .from("issues")
    .select("id, issue_number, date, origin, published, created_at")
    .eq("id", issueId)
    .single();

  return NextResponse.json({ issue: updatedIssue, articles: flattened });
}

async function renumberPositions(
  supabase: ReturnType<typeof createServiceClient>,
  issueId: string
) {
  const { data: rows } = await supabase
    .from("issue_articles")
    .select("article_id")
    .eq("issue_id", issueId)
    .order("position");

  if (!rows) return;

  for (let i = 0; i < rows.length; i++) {
    await supabase
      .from("issue_articles")
      .update({ position: i })
      .eq("issue_id", issueId)
      .eq("article_id", rows[i].article_id);
  }
}
