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

  const { data: source } = await supabase
    .from("discovered_sources")
    .select("*")
    .eq("id", id)
    .single();

  if (!source) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <p>Access denied</p>;

  const { data: curator } = await supabase
    .from("curators")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (curator?.role !== "editor") return <p>Access denied</p>;

  const { data: allTags } = await supabase
    .from("tags")
    .select("id, name, slug, facet, parent_id")
    .order("facet")
    .order("display_order");

  return <ReviewDetailClient source={source} allTags={allTags ?? []} />;
}
