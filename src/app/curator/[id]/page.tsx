import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function CuratorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: curator } = await supabase
    .from("curators")
    .select("id, display_name, bio, created_at, follower_counts(count)")
    .eq("id", id)
    .single();

  if (!curator) notFound();

  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, description, slug, created_at")
    .eq("curator_id", id)
    .eq("published", true)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link href="/" className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-300">
        ← Back
      </Link>

      <div className="mb-10">
        <h1 className="text-2xl font-semibold">{curator.display_name}</h1>
        {curator.bio && <p className="mt-3 text-zinc-400">{curator.bio}</p>}
        <p className="mt-4 text-sm text-zinc-600">
          {(curator as any).follower_counts?.[0]?.count ?? 0} followers · Joined{" "}
          {new Date(curator.created_at).toLocaleDateString()}
        </p>
      </div>

      <h2 className="mb-4 text-sm font-medium text-zinc-300">
        Published Collections ({(collections ?? []).length})
      </h2>

      {!collections?.length ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-12 text-center">
          <p className="text-zinc-400">No published collections yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {collections.map((col) => (
            <Link
              key={col.id}
              href={`/collections/${col.slug}`}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700 transition-colors"
            >
              <h3 className="font-medium">{col.name}</h3>
              {col.description && (
                <p className="mt-1 text-sm text-zinc-500">{col.description}</p>
              )}
              <p className="mt-2 text-xs text-zinc-600">{col.slug}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
