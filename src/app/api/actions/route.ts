import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

const VALID_ACTIONS = ["upvote", "downvote", "save", "dismiss"] as const;
type Action = (typeof VALID_ACTIONS)[number];

// POST — record a user action (vote/save/dismiss) on an article
// Requires auth. Returns 401 if not logged in (the login gate).
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to interact" }, { status: 401 });
  }

  const { articleId, action } = await req.json();

  if (!articleId || !action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: "articleId and valid action required" },
      { status: 400 }
    );
  }

  // Resolve the canonical article link server-side from articleId.
  // NEVER trust a client-supplied link — otherwise a user could apply their
  // vote to a *different* article's aggregate counts.
  let articleLink: string | null = null;
  if (action === "upvote" || action === "downvote") {
    const { data: article } = await supabase
      .from("articles")
      .select("link")
      .eq("id", articleId)
      .maybeSingle();
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    articleLink = article.link;
  }

  // Check if this action already exists (toggle pattern)
  const { data: existing } = await supabase
    .from("user_article_actions")
    .select("action")
    .eq("user_id", user.id)
    .eq("article_id", articleId)
    .eq("action", action)
    .maybeSingle();

  if (existing) {
    // Toggle OFF: remove the action
    await supabase
      .from("user_article_actions")
      .delete()
      .eq("user_id", user.id)
      .eq("article_id", articleId)
      .eq("action", action);

    // If it was a vote, update aggregate counts
    if ((action === "upvote" || action === "downvote") && articleLink) {
      const delta = action === "upvote" ? -1 : 1;
      const serviceClient = createServiceClient();
      await serviceClient.rpc("apply_vote", {
        p_link: articleLink,
        p_prev: action === "upvote" ? 1 : -1,
        p_next: 0,
      });
    }

    return NextResponse.json({ action, state: "removed" });
  }

  // Toggle ON: insert the action
  if (action === "upvote" || action === "downvote") {
    // Mutually exclusive: remove opposite vote first
    const opposite = action === "upvote" ? "downvote" : "upvote";
    const { data: hasOpposite } = await supabase
      .from("user_article_actions")
      .select("action")
      .eq("user_id", user.id)
      .eq("article_id", articleId)
      .eq("action", opposite)
      .maybeSingle();

    if (hasOpposite) {
      await supabase
        .from("user_article_actions")
        .delete()
        .eq("user_id", user.id)
        .eq("article_id", articleId)
        .eq("action", opposite);

      // Update aggregate: remove opposite, add new
      if (articleLink) {
        const serviceClient = createServiceClient();
        await serviceClient.rpc("apply_vote", {
          p_link: articleLink,
          p_prev: opposite === "upvote" ? 1 : -1,
          p_next: action === "upvote" ? 1 : -1,
        });
      }
    } else {
      // Just add the new vote
      if (articleLink) {
        const serviceClient = createServiceClient();
        await serviceClient.rpc("apply_vote", {
          p_link: articleLink,
          p_prev: 0,
          p_next: action === "upvote" ? 1 : -1,
        });
      }
    }
  }

  await supabase.from("user_article_actions").insert({
    user_id: user.id,
    article_id: articleId,
    action,
  });

  return NextResponse.json({ action, state: "added" });
}

// GET — batch hydrate user action state for a list of article IDs
// Returns { articleId: ["upvote", "save"], ... } or {} for anonymous users
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { searchParams } = new URL(req.url);
  const articleIds = searchParams.get("articleIds")?.split(",").filter(Boolean) ?? [];

  if (!user || articleIds.length === 0) {
    return NextResponse.json({});
  }

  const { data } = await supabase
    .from("user_article_actions")
    .select("article_id, action")
    .eq("user_id", user.id)
    .in("article_id", articleIds);

  const result: Record<string, string[]> = {};
  for (const row of data ?? []) {
    if (!result[row.article_id]) result[row.article_id] = [];
    result[row.article_id].push(row.action);
  }

  return NextResponse.json(result);
}
