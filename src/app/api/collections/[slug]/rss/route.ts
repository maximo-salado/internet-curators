import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Parser from "rss-parser";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  // Only serve published collections
  const { data: collection, error } = await supabase
    .from("collections")
    .select("id, name, description, curator_id, curators(display_name)")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (error || !collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch sources
  const { data: sources } = await supabase
    .from("sources")
    .select("feed_url, title, site_url")
    .eq("collection_id", collection.id);

  if (!sources?.length) {
    // Return empty but valid RSS
    return new NextResponse(emptyRss(collection.name, collection.description ?? ""), {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  // Parse all sources
  const parser = new Parser();
  const allItems: Array<{
    title: string;
    link: string;
    pubDate: string;
    contentSnippet?: string;
    sourceTitle: string;
  }> = [];

  await Promise.all(
    sources.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.feed_url);
        for (const item of feed.items ?? []) {
          allItems.push({
            title: item.title ?? "Untitled",
            link: item.link ?? "",
            pubDate: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
            contentSnippet: item.contentSnippet?.slice(0, 500),
            sourceTitle: source.title || feed.title || source.feed_url,
          });
        }
      } catch (error) {
          console.error(source.feed_url, error);
        }
    })
  );

  // Sort by date, deduplicate by link
  const seen = new Set<string>();
  const items = allItems
    .filter((item) => {
      if (seen.has(item.link)) return false;
      seen.add(item.link);
      return true;
    })
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  const curatorName = (collection as any).curators?.[0]?.display_name ?? "Unknown Curator";
  const rss = buildRss({
    title: `${collection.name} — curated by ${curatorName}`,
    description: collection.description || `RSS feed for ${collection.name} on Internet Curators`,
    link: `https://internet-curators.vercel.app/collections/${slug}`,
    items: items.slice(0, 50).map((item) => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      description: item.contentSnippet
        ? `${item.contentSnippet}<br/><br/><small>Source: ${item.sourceTitle}</small>`
        : `From ${item.sourceTitle}`,
    })),
  });

  return new NextResponse(rss, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}

function buildRss(opts: {
  title: string;
  description: string;
  link: string;
  items: Array<{ title: string; link: string; pubDate: string; description?: string }>;
}): string {
  const items = opts.items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>
      <description>${escapeXml(item.description ?? "")}</description>
      <guid>${escapeXml(item.link)}</guid>
    </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(opts.title)}</title>
    <description>${escapeXml(opts.description)}</description>
    <link>${escapeXml(opts.link)}</link>
    <atom:link href="${escapeXml(opts.link)}" rel="self" type="application/rss+xml"/>
    <generator>Internet Curators</generator>
${items}
  </channel>
</rss>`;
}

function emptyRss(title: string, description: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <description>${escapeXml(description)}</description>
    <link>https://internet-curators.vercel.app</link>
    <generator>Internet Curators</generator>
  </channel>
</rss>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
