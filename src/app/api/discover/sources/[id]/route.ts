import { createClient } from "@/lib/supabase/server";
import { refreshStaleSources } from "@/lib/feed-refresher";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await req.json();
  const action = body.action as "approve" | "reject" | "pending" | "parked";
  const reason = (body.reason as string) ?? "";
  const tagIds = (body.tag_ids as string[]) ?? [];

  // Must be an editor
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

  // Fetch the source
  const { data: source, error: fetchErr } = await supabase
    .from("discovered_sources")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const prev = source.status;
  const now = new Date().toISOString();

  // Resolve system curator for platform collections
  const { data: systemCurator } = await supabase
    .from("curators")
    .select("id")
    .eq("display_name", "Editorial Board")
    .is("user_id", null)
    .single();

  if (!systemCurator) {
    return NextResponse.json({ error: "System curator not configured" }, { status: 500 });
  }

  // --- APPROVE → main sources table ---
  if (action === "approve") {
    // Cleanup from previous state
    if (prev === "rejected") {
      await supabase.from("rejected_sources").delete().eq("feed_url", source.feed_url);
    }

    // Find or create "Editor's Picks" collection under the system curator
    const { data: collections } = await supabase
      .from("collections")
      .select("id")
      .eq("curator_id", systemCurator.id)
      .eq("name", "Editor's Picks")
      .limit(1);

    let collectionId: string;
    if (collections && collections.length > 0) {
      collectionId = collections[0].id;
    } else {
      const { data: newCol, error: colErr } = await supabase
        .from("collections")
        .insert({
          curator_id: systemCurator.id,
          name: "Editor's Picks",
          slug: `editors-picks-${Date.now()}`,
          description: "Editor-approved sources from the discovery pipeline.",
          published: true,
        })
        .select("id")
        .single();
      if (colErr || !newCol) {
        return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
      }
      collectionId = newCol.id;
    }

    // Insert into sources (skip if already there from previous approval)
    if (prev !== "approved") {
      const { error: insertErr } = await supabase
        .from("sources")
        .insert({
          collection_id: collectionId,
          feed_url: source.feed_url,
          site_url: source.site_url,
          title: source.title,
          description: source.description,
        });
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    }

    // Fetch articles for the newly approved source immediately
    try {
      const { data: sourceRows } = await supabase
        .from("sources")
        .select("id, feed_url, last_fetched_at")
        .eq("feed_url", source.feed_url)
        .limit(1);

      if (sourceRows?.[0]) {
        // Save editor-assigned tags (always clear old tags, then insert if any selected)
        await supabase.from("source_tags").delete().eq("source_id", sourceRows[0].id);
        if (tagIds.length > 0) {
          const tagRows = tagIds.map((tag_id: string) => ({
            source_id: sourceRows[0].id,
            tag_id,
          }));
          await supabase.from("source_tags").insert(tagRows);
        }

        await refreshStaleSources([{
          id: sourceRows[0].id,
          feed_url: sourceRows[0].feed_url,
          last_fetched_at: null,
        }]);
      }
    } catch (err) {
      console.error("Failed to fetch articles for approved source", {
        feed_url: source.feed_url,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await supabase
      .from("discovered_sources")
      .update({ status: "approved", reviewed_at: now, reviewed_by: curator.id })
      .eq("id", id);

    return NextResponse.json({ success: true, action: "approved" });
  }

  // --- REJECT → rejected_sources table ---
  if (action === "reject") {
    // Cleanup from previous state
    if (prev === "approved") {
      await supabase.from("sources").delete().eq("feed_url", source.feed_url);
    }

    // Log to rejected_sources (insert if not already there)
    if (prev !== "rejected") {
      await supabase
        .from("rejected_sources")
        .upsert({
          feed_url: source.feed_url,
          site_url: source.site_url,
          title: source.title,
          reason,
          rejected_by: curator.id,
        }, { onConflict: "feed_url" });
    }

    await supabase
      .from("discovered_sources")
      .update({ status: "rejected", reviewed_at: now, reviewed_by: curator.id })
      .eq("id", id);

    return NextResponse.json({ success: true, action: "rejected" });
  }

  // --- PENDING → revert to review queue, clean up artifacts ---
  if (action === "pending") {
    if (prev === "approved") {
      await supabase.from("sources").delete().eq("feed_url", source.feed_url);
    } else if (prev === "rejected") {
      await supabase.from("rejected_sources").delete().eq("feed_url", source.feed_url);
    }

    await supabase
      .from("discovered_sources")
      .update({ status: "pending", reviewed_at: null, reviewed_by: null })
      .eq("id", id);

    return NextResponse.json({ success: true, action: "pending" });
  }

  // --- PARKED → shelve for later, clean up artifacts ---
  if (action === "parked") {
    if (prev === "approved") {
      await supabase.from("sources").delete().eq("feed_url", source.feed_url);
    } else if (prev === "rejected") {
      await supabase.from("rejected_sources").delete().eq("feed_url", source.feed_url);
    }

    await supabase
      .from("discovered_sources")
      .update({ status: "parked", reviewed_at: now, reviewed_by: curator.id })
      .eq("id", id);

    return NextResponse.json({ success: true, action: "parked" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
