"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";

interface ArticleReaderProps {
  content: string;
  contentSnippet: string;
  articleLink: string;
}

export function ArticleReader({
  content,
  contentSnippet,
  articleLink,
}: ArticleReaderProps) {
  const sanitizedContent = useMemo(() => {
    if (!content) return null;

    try {
      // Sanitize HTML content to prevent XSS
      return DOMPurify.sanitize(content, {
        ALLOWED_TAGS: [
          "p", "br", "strong", "b", "em", "i", "u", "s", "del",
          "h1", "h2", "h3", "h4", "h5", "h6",
          "ul", "ol", "li",
          "blockquote", "pre", "code",
          "a", "img", "figure", "figcaption",
          "table", "thead", "tbody", "tr", "th", "td",
          "div", "span", "section", "article",
          "hr", "sup", "sub",
        ],
        ALLOWED_ATTR: [
          "href", "src", "alt", "title", "target", "rel",
          "class", "id", "width", "height",
        ],
        ALLOW_DATA_ATTR: false,
      });
    } catch {
      // If DOMPurify fails, return the snippet as plain text
      return null;
    }
  }, [content]);

  if (!sanitizedContent) {
    // No content available — show snippet + link to original
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        {contentSnippet ? (
          <p className="text-zinc-400 leading-relaxed whitespace-pre-line">
            {contentSnippet}
          </p>
        ) : (
          <p className="text-zinc-500 italic">
            No content preview available.
          </p>
        )}
        <a
          href={articleLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Read full article
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
    );
  }

  // Render sanitized HTML content
  return (
    <article
      className="prose prose-invert prose-zinc max-w-none
        prose-headings:text-zinc-100 prose-headings:font-semibold
        prose-p:text-zinc-300 prose-p:leading-relaxed
        prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
        prose-strong:text-zinc-200
        prose-blockquote:border-zinc-700 prose-blockquote:text-zinc-400
        prose-code:text-zinc-300 prose-code:bg-zinc-800 prose-code:rounded prose-code:px-1
        prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800
        prose-img:rounded-lg prose-img:my-6
        prose-li:text-zinc-300
        prose-hr:border-zinc-800
      "
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
}
