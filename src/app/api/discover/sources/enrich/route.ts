import { createClient } from "@/lib/supabase/server";
import { detectTrustSignals } from "@/lib/trust-signals";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  // Auth check: must be authenticated editor (matches pattern from PATCH handler)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: curator } = await supabase
    .from("curators")
    .select("id, role")
    .eq("user_id", user.id)
    .single();
  if (!curator || curator.role !== "editor") {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const body = await req.json();
  const sourceId = body.source_id as string;
  if (!sourceId) {
    return NextResponse.json({ error: "source_id required" }, { status: 400 });
  }

  // Fetch source (include platform for tag mapping)
  const { data: source, error: fetchErr } = await supabase
    .from("discovered_sources")
    .select("id, site_url, platform, independence_signals")
    .eq("id", sourceId)
    .single();

  if (fetchErr || !source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  if (!source.site_url) {
    return NextResponse.json({ error: "Source has no site_url" }, { status: 400 });
  }

  // Skip if already enriched (one-shot — _enrichment_attempted flag prevents re-runs)
  const existing = (source.independence_signals as Record<string, unknown>) ?? {};
  if (existing._enrichment_attempted) {
    return NextResponse.json({ enriched: false, reason: "already_enriched" });
  }

  // Run detection with new signature: site_url, platform, has_trackers
  const result = await detectTrustSignals(
    source.site_url,
    source.platform ?? undefined,
    (source.independence_signals as Record<string, unknown>)?.has_trackers as boolean | undefined,
  );

  // Resolve slugs to tag IDs and insert into discovered_source_tags
  if (result.suggested_tag_slugs.length > 0) {
    const { data: tagRows, error: tagErr } = await supabase
      .from("tags")
      .select("id, slug")
      .in("slug", result.suggested_tag_slugs);

    if (!tagErr && tagRows) {
      const tagIds = tagRows.map((t: { id: string }) => t.id);
      // Upsert: ignore duplicates on (source_id, tag_id) conflict
      await supabase.from("discovered_source_tags").upsert(
        tagIds.map((tag_id: string) => ({ source_id: sourceId, tag_id })),
        { onConflict: "source_id,tag_id", ignoreDuplicates: true },
      );
    }
  }

  // Persist editorial_standards_url in jsonb (it's a URL, not a tag)
  // Only mark _enrichment_attempted on successful jsonb update
  const update: Record<string, unknown> = { _enrichment_attempted: true };
  if (result.editorial_standards_url) {
    update.editorial_standards_url = result.editorial_standards_url;
  }

  const { error: updateErr } = await supabase
    .from("discovered_sources")
    .update({ independence_signals: { ...existing, ...update } })
    .eq("id", sourceId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    enriched: true,
    suggested_tag_slugs: result.suggested_tag_slugs,
    failed: !!result._enrichment_failed,
    _enrichment_attempted: true,
  });
}
