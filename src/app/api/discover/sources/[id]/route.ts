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
  const action = body.action as "approve" | "reject" | "pending" | "parked" | "update_tags";
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
        const newSourceId = sourceRows[0].id;

        // Clear old tags from source_tags before re-inserting (handles re-approval)
        await supabase.from("source_tags").delete().eq("source_id", newSourceId);

        // Collect all tag IDs (editor-assigned + discovered), deduplicate, insert once
        const allTagIds = new Set<string>(tagIds);

        const { data: dst } = await supabase
          .from("discovered_source_tags")
          .select("tag_id")
          .eq("source_id", id);
        if (dst?.length) {
          for (const r of dst) allTagIds.add(r.tag_id);
        }

        if (allTagIds.size > 0) {
          const tagRows = [...allTagIds].map((tag_id) => ({
            source_id: newSourceId,
            tag_id,
          }));
          const { error: tagInsertErr } = await supabase.from("source_tags").upsert(tagRows, {
            onConflict: "source_id,tag_id",
            ignoreDuplicates: true,
          });
          if (tagInsertErr) {
            console.error("Failed to copy tags on approve", tagInsertErr);
          }
        }

        await refreshStaleSources([{
          id: newSourceId,
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

  // --- UPDATE_TAGS → delete-then-insert tag assignment ---
  if (action === "update_tags") {
    const newTagIds = (body.tag_ids as string[]) ?? [];

    // If source is already approved, also update source_tags to prevent split-brain
    if (source.status === "approved") {
      const { data: approvedSource } = await supabase
        .from("sources")
        .select("id")
        .eq("feed_url", source.feed_url)
        .limit(1)
        .single();

      if (approvedSource) {
        await supabase.from("source_tags").delete().eq("source_id", approvedSource.id);
        if (newTagIds.length > 0) {
          await supabase.from("source_tags").insert(
            newTagIds.map((tid: string) => ({ source_id: approvedSource.id, tag_id: tid }))
          );
        }
      }
    }

    // Always update discovered_source_tags (delete-then-insert)
    const { error: delErr } = await supabase.from("discovered_source_tags").delete().eq("source_id", id);
    if (delErr) {
      console.error("Failed to delete discovered_source_tags", delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
    if (newTagIds.length > 0) {
      const { error: insErr } = await supabase.from("discovered_source_tags").insert(
        newTagIds.map((tid: string) => ({
          source_id: id,
          tag_id: tid,
          edited_by: curator.id,
        }))
      );
      if (insErr) {
        console.error("Failed to insert discovered_source_tags", insErr);
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, tag_ids: newTagIds });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
