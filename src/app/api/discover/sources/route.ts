import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
  const order = (searchParams.get("order") ?? "desc") === "asc" ? "asc" : "desc";
  const search = searchParams.get("search")?.trim() || null;
  const tags = searchParams.getAll("tag").filter(Boolean);

  // Check if user is an editor
  let isEditor = false;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: curator } = await supabase
      .from("curators")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (curator?.role === "editor") isEditor = true;
  }

  // Build query: search → status → tag → pagination
  let query = supabase
    .from("discovered_sources")
    .select("*", { count: "exact" })
    .order("discovered_at", { ascending: order === "asc" });

  // 1. Apply search filter (ILIKE on title and feed_url).
  // The user term is interpolated into a PostgREST `.or()` string, where `,`
  // `.` `(` `)` are reserved syntax — wrap the value in double quotes so those
  // are treated literally, and escape `"` / `\` (the quoted-value escape chars)
  // to prevent filter injection.
  if (search) {
    const safe = search.replace(/[\\"]/g, (m) => "\\" + m);
    query = query.or(`title.ilike."%${safe}%",feed_url.ilike."%${safe}%"`);
  }

  // 2. Apply status filter
  if (status !== "all") {
    query = query.eq("status", status);
  }

  // 3. Apply multi-tag filter (AND logic via discovered_source_tags intersection)
  if (tags.length > 0) {
    // Resolve tag slugs to tag IDs (include facet + name for language/stance checks)
    const { data: tagRows } = await supabase
      .from("tags")
      .select("id, slug, facet, name")
      .in("slug", tags);

    if (!tagRows || tagRows.length === 0) {
      // No matching tags → return empty
      return NextResponse.json({
        items: [],
        total: 0,
        hasMore: false,
        isEditor,
      });
    }

    // Collect source ID sets per tag, then intersect.
    // For each requested tag, also include its children (parent_id = tag.id)
    // so that selecting a parent like "arts-culture" matches sources tagged
    // with children like "design", "music", "gaming".
    const sourceIdSets: Set<string>[] = [];
    for (const tagRow of tagRows) {
      // Find all child tags (with slugs + names for suggested_tags check)
      const { data: childRows } = await supabase
        .from("tags")
        .select("id, slug, name")
        .eq("parent_id", tagRow.id);

      // Build the full set of tag IDs: parent + all children
      const allTagIds = [tagRow.id, ...(childRows ?? []).map((c) => c.id)];
      // Also collect all slugs for suggested_tags JSON array check
      const allSlugs = [tagRow.slug, ...(childRows ?? []).map((c) => c.slug)];

      // Collect source IDs from the junction table (existing manual tags)
      const ids = new Set<string>();
      const { data: linkRows } = await supabase
        .from("discovered_source_tags")
        .select("source_id")
        .in("tag_id", allTagIds);
      for (const r of (linkRows ?? [])) ids.add(r.source_id);

      // ALSO collect source IDs from suggested_tags JSON array (auto-detected tags:
      // format, language, voice, stance). Each slug is checked individually against
      // the JSONB array column via the @> (contains) operator.
      for (const slug of allSlugs) {
        const { data: suggestedRows } = await supabase
          .from("discovered_sources")
          .select("id")
          .contains("suggested_tags", [slug]);
        for (const row of (suggestedRows ?? [])) ids.add(row.id);
      }

      // Also check suggested_tags against tag NAMES (lowercase) — catches cases
      // where suggested_tags uses informal names (e.g. "progressive", "worker-owned")
      // instead of the formal slug (e.g. "stance-progressive", "stance-worker-owned").
      for (const tag of [tagRow, ...(childRows ?? [])]) {
        const name = (tag as any).name?.toLowerCase();
        if (name && !allSlugs.includes(name)) {
          const { data: nameRows } = await supabase
            .from("discovered_sources")
            .select("id")
            .contains("suggested_tags", [name]);
          for (const row of (nameRows ?? [])) ids.add(row.id);
        }
      }

      // Language facet: query the language column directly.
      // Language tags (e.g. lang-en, en, lang-es, es) are NOT in suggested_tags
      // or the junction table — they live in discovered_sources.language ('en'/'es').
      if (tagRow.facet === "language") {
        // Extract language code from slug: lang-en → en, lang-es → es, en → en, es → es
        const langCode = tagRow.slug.replace(/^lang-/, "");
        const { data: langRows } = await supabase
          .from("discovered_sources")
          .select("id")
          .eq("language", langCode);
        for (const row of (langRows ?? [])) ids.add(row.id);
      }

      if (ids.size > 0) sourceIdSets.push(ids);
    }

    // If any tag matched zero sources, the AND intersection is empty
    if (sourceIdSets.length < tags.length) {
      return NextResponse.json({
        items: [],
        total: 0,
        hasMore: false,
        isEditor,
      });
    }

    // Intersect all sets with AND logic
    const intersected = sourceIdSets.reduce((acc, set) => {
      return new Set(Array.from(acc).filter((id) => set.has(id)));
    });

    if (intersected.size === 0) {
      return NextResponse.json({
        items: [],
        total: 0,
        hasMore: false,
        isEditor,
      });
    }

    query = query.in("id", Array.from(intersected));
  }

  // 4. Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sources = data ?? [];

  // Fetch tags for all returned sources (tag enrichment)
  if (sources.length > 0) {
    const sourceIds = sources.map((s) => s.id);
    const { data: enrichmentTagRows } = await supabase
      .from("discovered_source_tags")
      .select("source_id, tag_id, tags!inner(slug, name, facet)")
      .in("source_id", sourceIds);

    // Merge tags into each source
    const tagsBySource = new Map<string, Array<{ slug: string; name: string; facet: string }>>();
    for (const row of (enrichmentTagRows ?? [])) {
      const tag = (row as any).tags;
      if (!tag) continue;
      const list = tagsBySource.get(row.source_id) ?? [];
      list.push({ slug: tag.slug, name: tag.name, facet: tag.facet });
      tagsBySource.set(row.source_id, list);
    }

    for (const source of sources) {
      (source as any).tags = tagsBySource.get(source.id) ?? [];
    }
  }

  return NextResponse.json({
    items: sources,
    total: count ?? 0,
    hasMore: (count ?? 0) > offset + limit,
    isEditor,
  });
}
