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

  // Fetch the discovered source
  const { data: source } = await supabase
    .from("discovered_sources")
    .select("*")
    .eq("id", id)
    .single();

  if (!source) notFound();

  // Editor role check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p>Access denied</p>;

  const { data: curator } = await supabase
    .from("curators")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (curator?.role !== "editor") return <p>Access denied</p>;

  // Fetch taxonomy tags for TagSelector
  const { data: allTags } = await supabase
    .from("tags")
    .select("id, name, slug, facet, parent_id")
    .order("facet")
    .order("display_order");

  // Fetch discovered_source_tags for the source
  const { data: sourceTags } = await supabase
    .from("discovered_source_tags")
    .select("tag_id")
    .eq("source_id", id);

  const sourceTagIds = (sourceTags ?? []).map(
    (st: { tag_id: string }) => st.tag_id,
  );

  return (
    <ReviewDetailClient
      source={source}
      allTags={allTags ?? []}
      initialTagIds={sourceTagIds}
    />
  );
}
