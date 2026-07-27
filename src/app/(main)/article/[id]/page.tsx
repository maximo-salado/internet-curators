import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleActionBar } from "@/components/ArticleActionBar";
import { ArticleReader } from "@/components/ArticleReader";

export const revalidate = 300;

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch article with source join
  const { data: article } = await supabase
    .from("articles")
    .select(
      "id, title, link, pub_date, content_snippet, content, image, source_id, sources!inner(id, title, site_url, feed_url)"
    )
    .eq("id", id)
    .single();

  if (!article) notFound();

  const source = (article as any).sources;

  // Fetch tags for this article
  const { data: articleTags } = await supabase
    .from("article_tags")
    .select("tag_id, tags!inner(id, name, slug, facet)")
    .eq("article_id", id);

  const tags = (articleTags ?? []).map((at: any) => at.tags);

  // Fetch vote counts from article_votes (by link)
  const { data: voteData } = await supabase
    .from("article_votes")
    .select("upvotes, downvotes")
    .eq("link", article.link)
    .maybeSingle();

  const upvotes = voteData?.upvotes ?? 0;
  const downvotes = voteData?.downvotes ?? 0;

  // Check auth state
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  // Fetch user actions for this article if logged in
  let userActions: string[] = [];
  if (user) {
    const { data: actions } = await supabase
      .from("user_article_actions")
      .select("action")
      .eq("user_id", user.id)
      .eq("article_id", id);

    userActions = (actions ?? []).map((a: any) => a.action);
  }

  const pubDate = article.pub_date
    ? new Date(article.pub_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const hasContent = !!article.content;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 sm:px-6 pb-20">
      {/* Top bar: back arrow + external link */}
      <div className="sticky top-0 z-10 flex items-center justify-between py-3 bg-black/80 backdrop-blur-sm">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Back</span>
        </Link>

        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <span className="hidden sm:inline">Open original</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </a>
      </div>

      {/* Source badge */}
      {source && (
        <div className="mb-4">
          <Link
            href={`/source/${source.id}`}
            className="inline-block rounded-full px-2.5 py-1 text-xs font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
          >
            {source.title}
          </Link>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tags
            .filter((t: any) => t.facet === "topic" || t.facet === "voice")
            .slice(0, 6)
            .map((tag: any) => (
              <Link
                key={tag.id}
                href={`/?tags=${tag.slug}`}
                className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                  tag.facet === "voice"
                    ? "text-zinc-500 border border-zinc-800 hover:text-zinc-300"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
              >
                {tag.name}
              </Link>
            ))}
        </div>
      )}

      {/* Title */}
      <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-zinc-100 mb-4">
        {article.title}
      </h1>

      {/* Publication date */}
      {pubDate && (
        <p className="text-sm text-zinc-500 mb-6">{pubDate}</p>
      )}

      {/* Content */}
      <div className="prose prose-invert prose-zinc max-w-none mb-8">
        {hasContent ? (
          <ArticleReader
            content={article.content!}
            contentSnippet={article.content_snippet ?? ""}
            articleLink={article.link}
          />
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-zinc-400 leading-relaxed">
              {article.content_snippet || "No content available for this article."}
            </p>
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Read full article on {source?.title || "original site"}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </a>
          </div>
        )}
      </div>

      {/* Padding for fixed bottom bar */}
      <div className="h-16" />

      {/* Fixed action bar */}
      <ArticleActionBar
        articleId={article.id}
        articleLink={article.link}
        upvotes={upvotes}
        downvotes={downvotes}
        isLoggedIn={isLoggedIn}
        userActions={userActions}
      />
    </main>
  );
}
