import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ReviewDetailClient } from "@/components/ReviewDetailClient";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth check FIRST — prevents source existence info leak
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <p className="mx-auto max-w-2xl px-6 py-12 text-zinc-400">Sign in required</p>;

  const { data: curator } = await supabase
    .from("curators")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (curator?.role !== "editor") {
    return <p className="mx-auto max-w-2xl px-6 py-12 text-zinc-400">Editor access required</p>;
  }

  const { data: source } = await supabase
    .from("discovered_sources")
    .select("*")
    .eq("id", id)
    .single();

  if (!source) notFound();

  const { data: allTags } = await supabase
    .from("tags")
    .select("id, name, slug, facet, parent_id")
    .order("facet")
    .order("display_order");

  return <ReviewDetailClient source={source} allTags={allTags ?? []} />;
}
