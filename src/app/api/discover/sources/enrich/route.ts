import { createClient } from "@/lib/supabase/server";
import { detectTrustSignals, mergeTrustSignals } from "@/lib/trust-signals";
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

  // Fetch source
  const { data: source, error: fetchErr } = await supabase
    .from("discovered_sources")
    .select("id, site_url, independence_signals")
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

  // Run detection
  const trustSignals = await detectTrustSignals(source.site_url);

  // Merge and update
  const merged = mergeTrustSignals(existing, trustSignals);
  const { error: updateErr } = await supabase
    .from("discovered_sources")
    .update({ independence_signals: merged })
    .eq("id", sourceId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    enriched: true,
    signals: trustSignals,
    failed: !!trustSignals._enrichment_failed,
    _enrichment_attempted: true,
  });
}
