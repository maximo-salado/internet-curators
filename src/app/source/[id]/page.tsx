import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { SourceDetailClient } from "@/components/SourceDetailClient";

export const revalidate = 300;

export default async function SourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Fetch source data
  const { data: source } = await supabase
    .from("sources")
    .select("id, title, description, site_url")
    .eq("id", id)
    .single();

  if (!source) notFound();

  // 2. Fetch recent articles from this source
  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, link, pub_date, content_snippet, image, source_id")
    .eq("source_id", id)
    .order("pub_date", { ascending: false })
    .limit(20);

  // 3. Fetch vote counts for all articles
  const articleLinks = (articles ?? []).map((a) => a.link);
  let voteMap = new Map<string, { upvotes: number; downvotes: number }>();

  if (articleLinks.length > 0) {
    const { data: votes } = await supabase
      .from("article_votes")
      .select("link, upvotes, downvotes")
      .in("link", articleLinks);

    for (const v of votes ?? []) {
      voteMap.set(v.link, { upvotes: v.upvotes, downvotes: v.downvotes });
    }
  }

  // 4. Check auth state
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  // 5. Fetch user actions if logged in
  let userActionsMap: Record<string, string[]> = {};

  if (user && articles && articles.length > 0) {
    const articleIds = articles.map((a) => a.id);
    const { data: actions } = await supabase
      .from("user_article_actions")
      .select("article_id, action")
      .eq("user_id", user.id)
      .in("article_id", articleIds);

    for (const row of actions ?? []) {
      if (!userActionsMap[row.article_id]) {
        userActionsMap[row.article_id] = [];
      }
      userActionsMap[row.article_id].push(row.action);
    }
  }

  // 6. Build article data with vote counts
  const articleData = (articles ?? []).map((article) => {
    const votes = voteMap.get(article.link);
    return {
      id: article.id,
      title: article.title,
      link: article.link,
      pub_date: article.pub_date,
      content_snippet: article.content_snippet,
      image: article.image,
      source_id: article.source_id,
      upvotes: votes?.upvotes ?? 0,
      downvotes: votes?.downvotes ?? 0,
    };
  });

  return (
    <SourceDetailClient
      source={{
        id: source.id,
        title: source.title,
        description: source.description,
        site_url: source.site_url,
      }}
      articles={articleData}
      isLoggedIn={isLoggedIn}
      userActionsMap={userActionsMap}
    />
  );
}
