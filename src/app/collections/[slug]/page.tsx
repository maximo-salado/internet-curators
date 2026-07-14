import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import Parser from "rss-parser";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from("collections")
    .select("id, name, description, curator_id, curators(display_name, id)")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!collection) notFound();

  const curatorName = (collection as any).curators?.display_name ?? "Unknown";
  const curatorId = (collection as any).curators?.id;

  // Fetch and parse sources for this collection
  const { data: sources } = await supabase
    .from("sources")
    .select("feed_url, title, site_url")
    .eq("collection_id", collection.id);

  const parser = new Parser();
  const articles: Array<{
    title: string;
    link: string;
    pubDate: string;
    sourceTitle: string;
    contentSnippet: string;
  }> = [];

  if (sources) {
    await Promise.all(
      sources.map(async (source) => {
        try {
          const feed = await parser.parseURL(source.feed_url);
          for (const item of feed.items ?? []) {
            articles.push({
              title: item.title ?? "Untitled",
              link: item.link ?? "",
              pubDate: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
              sourceTitle: source.title || feed.title || source.feed_url,
              contentSnippet: (item.contentSnippet ?? "").slice(0, 300),
            });
          }
        } catch {}
      })
    );
  }

  // Deduplicate and sort
  const seen = new Set<string>();
  const items = articles
    .filter((a) => {
      if (seen.has(a.link)) return false;
      seen.add(a.link);
      return true;
    })
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 50);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link href={curatorId ? `/curator/${curatorId}` : "/"} className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-300">
        ← Back to {curatorName}
      </Link>

      <div className="mb-10">
        <h1 className="text-2xl font-semibold">{collection.name}</h1>
        {collection.description && (
          <p className="mt-2 text-zinc-400">{collection.description}</p>
        )}
        <p className="mt-3 text-sm text-zinc-600">
          curated by {curatorName} · {items.length} articles
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-12 text-center">
          <p className="text-zinc-400">No articles yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.link}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-zinc-500">{item.sourceTitle}</span>
              </div>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <h2 className="font-medium leading-snug hover:text-zinc-300 transition-colors">
                  {item.title}
                </h2>
              </a>
              {item.contentSnippet && (
                <p className="mt-2 text-sm text-zinc-500 line-clamp-2">
                  {item.contentSnippet}
                </p>
              )}
              <p className="mt-3 text-xs text-zinc-600">
                {new Date(item.pubDate).toLocaleDateString()}
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
