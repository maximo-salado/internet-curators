"use client";

import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";

interface SourceData {
  id: string;
  title: string;
  description: string | null;
  site_url: string | null;
}

interface ArticleData {
  id: string;
  title: string;
  link: string;
  pub_date: string;
  content_snippet: string | null;
  image: string | null;
  source_id: string;
  upvotes: number;
  downvotes: number;
}

interface SourceDetailClientProps {
  source: SourceData;
  articles: ArticleData[];
  isLoggedIn: boolean;
  userActionsMap: Record<string, string[]>;
}

export function SourceDetailClient({
  source,
  articles,
  isLoggedIn,
  userActionsMap,
}: SourceDetailClientProps) {
  const siteUrlDisplay = source.site_url
    ? source.site_url.replace(/^https?:\/\//, "")
    : null;

  const initialLetter = source.title?.charAt(0)?.toUpperCase() || "?";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 sm:px-6 py-6">
      {/* Back arrow */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-6"
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
        <span>Back</span>
      </Link>

      {/* Source header */}
      <div className="mb-8">
        <div className="flex items-start gap-4">
          {/* Initial letter avatar */}
          <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center">
            <span className="text-2xl font-bold text-zinc-300">
              {initialLetter}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            {/* Source name */}
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 leading-tight">
              {source.title || "Untitled Source"}
            </h1>

            {/* Description */}
            {source.description && (
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                {source.description}
              </p>
            )}

            {/* Site URL */}
            {siteUrlDisplay && (
              <a
                href={source.site_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
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
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                <span className="truncate">{siteUrlDisplay}</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Recent Articles section */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-200 mb-4">
          Recent Articles
        </h2>

        {articles.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-12 text-center">
            <p className="text-4xl mb-4">📄</p>
            <p className="text-zinc-400">No articles from this source yet</p>
            <p className="mt-2 text-sm text-zinc-600">
              Check back later for new content.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {articles.map((article, i) => (
              <ArticleCard
                key={`${article.link}-${i}`}
                item={{
                  title: article.title,
                  link: article.link,
                  pubDate: article.pub_date,
                  sourceTitle: source.title,
                  sourceUrl: source.site_url ?? "",
                  sourceId: article.source_id,
                  curatorNames: [],
                  curatorIds: [],
                  contentSnippet: article.content_snippet ?? "",
                  image: article.image ?? undefined,
                  upvotes: article.upvotes,
                  downvotes: article.downvotes,
                }}
                articleId={article.id}
                onRemoveSource={() => {}}
                hidden={false}
                isLoggedIn={isLoggedIn}
                userActions={userActionsMap[article.id] ?? []}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
