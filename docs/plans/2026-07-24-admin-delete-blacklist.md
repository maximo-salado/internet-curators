# Admin — Delete Source + Cascade Articles + Blacklist
**Issue:** #126
**Date:** 2026-07-24

---

## Problem

The current Sources tab only soft-pauses a feed (`hidden=true`). For illegal content, copyright violations, and DMCA takedowns we need:
1. Hard delete — remove the source and all its cached articles permanently.
2. Blacklist — prevent the same feed URL from being re-imported on the next cron run.

---

## What already exists

| Thing | Location | Notes |
|---|---|---|
| Sources tab with Hide toggle | `src/app/admin/page.tsx` | Good UX pattern to copy for delete confirm |
| PATCH handler | `src/app/api/admin/sources/[id]/route.ts` | We add DELETE to the same file |
| Feed cron refresh | `src/app/api/feed/route.ts` POST | Already skips `hidden=true`; add blacklist check |
| `sources.hidden` column | migration 020 | FK from `articles.source_id` exists |

---

## DB changes — Migration 021

New table only. No changes to existing tables.

```sql
-- 021_blacklisted_feeds.sql
CREATE TABLE blacklisted_feeds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_url    text UNIQUE NOT NULL,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Only service-role / admin can read or write
ALTER TABLE blacklisted_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON blacklisted_feeds USING (false);
```

No cascade needed in SQL — the API handles deletion order explicitly.

---

## Phase 1 — Migration

**File (new):** `supabase/migrations/021_blacklisted_feeds.sql`

Run locally with `supabase db push`, then apply to prod. Nothing else depends on prior phases.

---

## Phase 2 — DELETE API endpoint

**File (changed):** `src/app/api/admin/sources/[id]/route.ts`

Add a `DELETE` export alongside the existing `PATCH`. Use the **service client** (not the user-session client) so RLS on `blacklisted_feeds` doesn't block the insert.

```ts
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  let blacklist = false;
  try {
    const body = await req.json();
    blacklist = body.blacklist === true;
  } catch { /* body is optional */ }

  const supabase = createServiceClient();      // needs service key for blacklist table

  // 1. Get feed_url before deletion (needed for blacklist)
  const { data: source, error: fetchErr } = await supabase
    .from("sources")
    .select("feed_url")
    .eq("id", id)
    .single();

  if (fetchErr || !source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  // 2. Optionally blacklist the URL
  if (blacklist) {
    await supabase
      .from("blacklisted_feeds")
      .upsert({ feed_url: source.feed_url }, { onConflict: "feed_url" });
  }

  // 3. Delete articles first (FK constraint)
  const { count: articlesRemoved } = await supabase
    .from("articles")
    .delete({ count: "exact" })
    .eq("source_id", id);

  // 4. Delete the source
  const { error: deleteErr } = await supabase
    .from("sources")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, articlesRemoved, blacklisted: blacklist });
}
```

Note: steps 2–4 are not wrapped in a DB transaction. If step 4 fails after blacklisting, the URL is blacklisted but the source still exists — harmless because it's also hideable and the blacklist only gates re-import. Acceptable tradeoff given Supabase JS client has no multi-statement transaction API.

---

## Phase 3 — Feed refresh skips blacklisted URLs

**File (changed):** `src/app/api/feed/route.ts` — POST handler only.

After fetching sources, pull the blacklist and filter before passing to `refreshStaleSources`:

```ts
// After: const { data: sources, error } = await supabase.from("sources")...

const { data: blacklisted } = await supabase
  .from("blacklisted_feeds")
  .select("feed_url");

const blacklistedUrls = new Set((blacklisted ?? []).map((b: any) => b.feed_url));

const toRefresh = (sources ?? []).filter((s) => !blacklistedUrls.has(s.feed_url));
await refreshStaleSources(toRefresh);
```

The GET handler doesn't need changes — deleted sources produce no articles; there's nothing to filter.

---

## Phase 4 — Admin UI

**File (changed):** `src/app/admin/page.tsx`

Follow the exact inline-confirm pattern already used for tag delete (`deletingId` / confirm row).

### State additions (Sources section)

```ts
const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
const [blacklistOnDelete, setBlacklistOnDelete] = useState(false);
```

### Handler

```ts
const deleteSource = async (source: AdminSource) => {
  setError(null);
  try {
    const res = await fetch(`/api/admin/sources/${source.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blacklist: blacklistOnDelete }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Delete failed");
    }
    setDeletingSourceId(null);
    setBlacklistOnDelete(false);
    await fetchSources();
  } catch (e: any) {
    setError(e.message);
  }
};
```

### Table column change

Replace the single `Status` column cell with two buttons — keep Hide/Show, add Delete:

```tsx
<td className="px-4 py-3 text-right">
  {deletingSourceId === s.id ? (
    <div className="flex flex-col items-end gap-2">
      <span className="text-xs text-red-400">
        Delete &quot;{s.title}&quot; and {count(s.articles)} articles?
      </span>
      <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
        <input
          type="checkbox"
          checked={blacklistOnDelete}
          onChange={(e) => setBlacklistOnDelete(e.target.checked)}
          className="accent-red-500"
        />
        Blacklist feed URL
      </label>
      <div className="flex gap-1.5">
        <button
          onClick={() => deleteSource(s)}
          className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500 transition-colors"
        >
          Delete
        </button>
        <button
          onClick={() => { setDeletingSourceId(null); setBlacklistOnDelete(false); }}
          className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-end gap-1.5">
      <button onClick={() => toggleHidden(s)} ...>
        {/* existing Hide/Show button unchanged */}
      </button>
      <button
        onClick={() => setDeletingSourceId(s.id)}
        className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-red-400 hover:border-red-800 transition-colors"
      >
        Delete
      </button>
    </div>
  )}
</td>
```

The `Status` column header should be renamed to `Actions` and the column count in the empty-state `colSpan` bumped from 5 to 5 (no change — column count stays the same, we merge Hide + Delete into one cell).

---

## Files changed vs new

| File | Change |
|---|---|
| `supabase/migrations/021_blacklisted_feeds.sql` | **New** — blacklist table |
| `src/app/api/admin/sources/[id]/route.ts` | **Changed** — add `DELETE` export |
| `src/app/api/feed/route.ts` | **Changed** — POST filters blacklisted URLs |
| `src/app/admin/page.tsx` | **Changed** — delete button + inline confirm in Sources tab |

---

## Build order

1. **Migration** — apply 021 before any other step. Nothing else works without the table.
2. **DELETE API** — self-contained, testable with `curl -X DELETE`.
3. **Feed refresh filter** — one extra query in POST; safe to deploy standalone.
4. **Admin UI** — last, since it calls the API from step 2.

Each phase is independently deployable. Steps 2–4 can ship together after the migration lands.

---

## What this doesn't cover

- Audit log of who deleted what (no users table for admins; could add a `deleted_by` text column later).
- Bulk delete (can be added as a follow-up once the single-row flow is stable).
- Re-importing a blacklisted feed (admin would need to manually DELETE from `blacklisted_feeds` in the DB; no UI needed for now).
