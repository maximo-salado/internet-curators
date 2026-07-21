import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SourceFollowButton } from "@/components/SourceFollowButton";
import { SourceTagEditor } from "@/components/SourceTagEditor";
import { TagSelector } from "@/components/TagSelector";

export const revalidate = 300;

export default async function SourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: source } = await supabase
    .from("sources")
    .select("id, title, description, site_url, feed_url, created_at")
    .eq("id", id)
    .single();

  if (!source) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  let isEditor = false;
  if (user) {
    const { data: curator } = await supabase
      .from("curators")
      .select("role")
      .eq("user_id", user.id)
      .single();
    isEditor = curator?.role === "editor";
  }

  const { data: sourceTags } = await supabase
    .from("source_tags")
    .select("tag_id")
    .eq("source_id", id);

  const sourceTagIds = (sourceTags ?? []).map((st: any) => st.tag_id as string);

  const { data: allTags } = await supabase
    .from("tags")
    .select("id, name, slug, facet, parent_id")
    .order("facet")
    .order("display_order");

  const { data: articles } = await supabase
    .from("articles")
    .select("title, link, pub_date, content_snippet")
    .eq("source_id", id)
    .order("pub_date", { ascending: false })
    .limit(100);

  // Published curators — shown with names and links
  const { data: publishedCurators } = await supabase
    .from("sources")
    .select("collections!inner(curator_id, curators!inner(display_name, id))")
    .eq("feed_url", source.feed_url)
    .eq("collections.published", true);

  // Total unique curator count (including private) — for count only
  const { count: totalCuratorCount } = await supabase
    .from("sources")
    .select("collections!inner(curator_id)", { count: "exact", head: true })
    .eq("feed_url", source.feed_url);

  const curatorMap = new Map<string, { id: string; display_name: string }>();
  for (const row of publishedCurators ?? []) {
    const c = (row as any).collections?.curators;
    if (c?.id && c?.display_name) {
      curatorMap.set(c.id, { id: c.id, display_name: c.display_name });
    }
  }
  const uniquePublished = Array.from(curatorMap.values());

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link href="/" className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-300">
        ← Back
      </Link>

      <div className="mb-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{source.title || "Untitled Source"}</h1>
          <SourceFollowButton sourceId={source.id} isLoggedIn={isLoggedIn} />
        </div>
        {source.description && (
          <p className="mt-3 text-zinc-400">{source.description}</p>
        )}
        {source.site_url && (
          <a
            href={source.site_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm text-zinc-500 hover:text-zinc-300"
          >
            {source.site_url.replace(/^https?:\/\//, "")} ↗
          </a>
        )}
        <p className="mt-3 text-sm text-zinc-600">
          {(articles ?? []).length} articles · Added{" "}
          {new Date(source.created_at).toLocaleDateString()}
        </p>

        {isEditor ? (
          <SourceTagEditor
            sourceId={source.id}
            initialTagIds={sourceTagIds}
            allTags={allTags ?? []}
          />
        ) : sourceTagIds.length > 0 ? (
          <div className="mt-4 border-t border-zinc-800 pt-3">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Tags</p>
            <TagSelector
              allTags={allTags ?? []}
              selectedTagIds={new Set(sourceTagIds)}
              onToggle={() => {}}
              facets={["topic", "stance", "format"]}
              readonly
            />
          </div>
        ) : null}
      </div>

      {uniquePublished.length > 0 ? (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-zinc-300">
            Curators tracking this source
            {totalCuratorCount ? ` (${totalCuratorCount})` : ` (${uniquePublished.length})`}
          </h2>
          <div className="flex flex-wrap gap-2">
            {uniquePublished.map((c) => (
              <Link
                key={c.id}
                href={`/curator/${c.id}`}
                className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-300 transition-colors"
              >
                {c.display_name}
              </Link>
            ))}
            {totalCuratorCount && totalCuratorCount > uniquePublished.length && (
              <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-600">
                +{totalCuratorCount - uniquePublished.length} other{totalCuratorCount - uniquePublished.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      ) : totalCuratorCount && totalCuratorCount > 0 ? (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-zinc-300">
            Tracked by {totalCuratorCount} curator{totalCuratorCount !== 1 ? "s" : ""}
          </h2>
        </div>
      ) : null}

      <h2 className="mb-4 text-sm font-medium text-zinc-300">
        Articles ({(articles ?? []).length})
      </h2>

      {!articles?.length ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-12 text-center">
          <p className="text-zinc-400">No articles yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((item) => (
            <article
              key={item.link}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700 transition-colors"
            >
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <h3 className="font-medium leading-snug hover:text-zinc-300 transition-colors">
                  {item.title}
                </h3>
              </a>
              {item.content_snippet && (
                <p className="mt-2 text-sm text-zinc-500 line-clamp-2">
                  {item.content_snippet}
                </p>
              )}
              <p className="mt-3 text-xs text-zinc-600">
                {new Date(item.pub_date).toLocaleDateString()}
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
