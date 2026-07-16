import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 300; // 5-minute ISR — reads from articles cache, no live RSS fetches

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    alternates: {
      types: {
        "application/rss+xml": [
          {
            title: "RSS Feed",
            url: `/api/collections/${slug}/rss`,
          },
        ],
      },
    },
  };
}

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

  // Fetch source IDs for this collection
  const { data: sources } = await supabase
    .from("sources")
    .select("id, title")
    .eq("collection_id", collection.id);

  const sourceIds = (sources ?? []).map((s) => s.id);

  // Read from the articles cache instead of fetching RSS live
  const seen = new Set<string>();
  const items: Array<{
    title: string;
    link: string;
    pubDate: string;
    sourceTitle: string;
    contentSnippet: string;
  }> = [];

  if (sourceIds.length > 0) {
    const { data: articles } = await supabase
      .from("articles")
      .select("title, link, pub_date, content_snippet, sources!inner(title)")
      .in("source_id", sourceIds)
      .order("pub_date", { ascending: false })
      .limit(50);

    for (const a of articles ?? []) {
      if (!a.link || seen.has(a.link)) continue;
      seen.add(a.link);
      items.push({
        title: a.title,
        link: a.link,
        pubDate: a.pub_date,
        sourceTitle: (a.sources as any)?.title || "Unknown",
        contentSnippet: (a.content_snippet ?? "").slice(0, 300),
      });
    }
  }

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
