"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import type { FeedItem } from "@/lib/compose-pages";

interface SourceInfo {
  title: string;
  description: string | null;
  site_url: string;
  tags: Array<{ id: string; name: string; slug: string; facet: string }>;
}

interface ArticlePageProps {
  item: FeedItem;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/** Strip all HTML tags from a string, preserving line breaks. */
function stripHtml(html: string): string {
  // Use DOMPurify with no allowed tags to strip everything,
  // then convert <br> (which DOMPurify preserves as <br>→\n in textContent
  // but not directly) — we strip via ALLOWED_TAGS: [] then handle newlines.
  const stripped = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
  // Convert any remaining <br> / <br/> entities and HTML entities
  return stripped
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function ArticlePage({ item }: ArticlePageProps) {
  const plainSnippet = useMemo(
    () => stripHtml(item.contentSnippet),
    [item.contentSnippet],
  );

  const sanitizedContent = useMemo(() => {
    if (!item.content) return null;
    try {
      return DOMPurify.sanitize(item.content, {
        ALLOWED_TAGS: [
          "p", "br", "strong", "b", "em", "i", "u", "s", "del",
          "h1", "h2", "h3", "h4", "h5", "h6",
          "ul", "ol", "li",
          "blockquote", "pre", "code",
          "a", "img", "figure",
          "table", "thead", "tbody", "tr", "th", "td",
          "div", "span", "section", "article",
          "hr", "sup", "sub",
          "figcaption",
        ],
        ALLOWED_ATTR: [
          "href", "src", "alt", "title", "target", "rel",
          "class", "id", "width", "height",
        ],
        ALLOW_DATA_ATTR: false,
      });
    } catch {
      return null;
    }
  }, [item.content]);

  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null);
  const [sourceLoading, setSourceLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    setSourceLoading(true);
    fetch(`/api/sources/${item.sourceId}`, { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.error) {
          setSourceInfo(data as SourceInfo);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!ac.signal.aborted) setSourceLoading(false);
      });
    return () => ac.abort();
  }, [item.sourceId]);

  const articleRef = useRef<HTMLElement>(null);

  // Hide images until they load; show alt text only on genuine failure
  useEffect(() => {
    if (!sanitizedContent || !articleRef.current) return;
    const imgs = articleRef.current.querySelectorAll("img");
    imgs.forEach((img) => {
      (img as HTMLImageElement).style.display = "none";
      img.addEventListener(
        "load",
        () => {
          (img as HTMLImageElement).style.display = "";
        },
        { once: true },
      );
      img.addEventListener(
        "error",
        () => {
          (img as HTMLImageElement).style.display = "";
        },
        { once: true },
      );
    });
  }, [sanitizedContent]);

  return (
    <div className="h-full overflow-y-auto bg-black text-zinc-100">
      <div className="mx-auto max-w-2xl px-5 py-12 sm:px-6">
        {/* Title */}
        <h1 className="text-[2.5rem] font-bold leading-tight font-serif mb-5">
          {item.title}
        </h1>

        {/* Source + date */}
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {item.sourceTitle}
          <span className="mx-1.5 text-zinc-700">·</span>
          {formatDate(item.pubDate)}
        </a>

        {/* Content snippet (plain text) — only when no structured HTML exists */}
        {!sanitizedContent && plainSnippet && (
          <p className="mt-6 text-base leading-relaxed text-zinc-400 whitespace-pre-line">
            {plainSnippet}
          </p>
        )}

        {/* Full sanitized HTML content */}
        {sanitizedContent && (
          <article
            ref={articleRef}
            className="prose prose-xl prose-invert prose-zinc mt-8 max-w-none font-serif
              prose-headings:font-serif prose-headings:tracking-tight prose-headings:text-zinc-100 prose-headings:font-bold
              prose-headings:mt-10 prose-headings:mb-4
              [&_p]:text-[20px] [&_p]:leading-[32px] [&_p]:text-zinc-300 [&_p]:mb-[30px]
              prose-a:text-blue-400 prose-a:underline prose-a:decoration-1 prose-a:underline-offset-2 hover:prose-a:text-blue-300
              prose-strong:text-zinc-200
              [&_blockquote]:border-l-[3px] [&_blockquote]:border-zinc-500 [&_blockquote]:text-zinc-400 [&_blockquote]:italic [&_blockquote]:pl-5

              prose-code:rounded prose-code:bg-zinc-800 prose-code:px-1 prose-code:text-zinc-300
              prose-pre:border prose-pre:border-zinc-800 prose-pre:bg-zinc-900
              prose-img:my-14 prose-img:rounded-lg
              [&_figure]:mb-14
              prose-li:text-zinc-300
              prose-hr:border-zinc-800
              [&_figcaption]:text-sm [&_figcaption]:text-zinc-400 [&_figcaption]:mt-4 [&_figcaption]:mb-8 [&_figcaption]:leading-relaxed
            "
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        )}

        {/* Source link */}
        <div className="mt-8 border-t border-zinc-800 pt-6">
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-400 transition-colors hover:text-blue-300"
          >
            Read full article →
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

        {/* Source Card */}
        <div className="mt-6 border-t border-zinc-800 pt-6">
          {sourceLoading ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 animate-pulse">
              <div className="h-5 w-48 rounded bg-zinc-800" />
              <div className="mt-2 h-4 w-full rounded bg-zinc-800" />
              <div className="mt-3 flex gap-1.5">
                <div className="h-5 w-16 rounded-full bg-zinc-800" />
                <div className="h-5 w-20 rounded-full bg-zinc-800" />
              </div>
            </div>
          ) : sourceInfo ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="font-semibold text-zinc-200">
                More from {sourceInfo.title || item.sourceTitle}
              </h3>
              {sourceInfo.description && (
                <p className="mt-1 text-sm text-zinc-400 line-clamp-2">
                  {sourceInfo.description}
                </p>
              )}
              {sourceInfo.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sourceInfo.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm text-blue-400 transition-colors hover:text-blue-300"
              >
                Visit {sourceInfo.title || item.sourceTitle} →
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
