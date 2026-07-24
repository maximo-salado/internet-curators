# Moderation + Admin Panel
**Issues:** #120 (source moderation) · #122 (tag management)
**Date:** 2026-07-24

---

## What we're building

A single `/admin` page with two tabs — Sources and Tags — accessible only to the platform owner. Plus a migration to add `hidden` to sources, and a feed filter to respect it.

---

## DB changes — Migration 020

One new column:

```sql
-- 020_source_hidden.sql
ALTER TABLE sources ADD COLUMN hidden boolean NOT NULL DEFAULT false;
CREATE INDEX idx_sources_hidden ON sources(hidden);
```

No other schema changes. Tags table already has everything needed (name, slug, facet, parent_id, keywords). Tag merging is purely data manipulation — reassign rows, then delete the source tag.

---

## Feed filter change

`/api/feed` route.ts — two places:

1. **GET (feed query):** Add `.eq("hidden", false)` to the sources select on line 53.
2. **POST (cron refresh):** Add `.eq("hidden", false)` to the sources select on line 274 so hidden sources don't get refreshed.

That's it — one-liner change per call site.

---

## Admin auth pattern

No role system. Simple env-var check on the server:

```ts
// src/lib/admin-auth.ts
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!user || !adminEmail || user.email !== adminEmail) return null;
  return user;
}
```

Every admin API route calls `requireAdmin()` and returns 403 if null. The page itself also calls it server-side and redirects to `/` if not admin.

Add `ADMIN_EMAIL=maximogomez492@gmail.com` to `.env.local` and Vercel env vars.

---

## New API endpoints

All live under `/api/admin/`. All check `requireAdmin()` first.

### Sources

**`GET /api/admin/sources`**
Returns all sources with article count and hidden status.
```ts
supabase.from("sources")
  .select("id, title, site_url, feed_url, hidden, last_fetched_at, articles(count)")
  .order("title")
```

**`PATCH /api/admin/sources/[id]`**
Body: `{ hidden: boolean }`. Updates the single field.

### Tags

**`GET /api/admin/tags`**
Returns all tags with article count (via article_tags).
```ts
supabase.from("tags")
  .select("id, name, slug, facet, parent_id, display_order, article_tags(count)")
  .order("facet").order("name")
```

**`PATCH /api/admin/tags/[id]`**
Body: `{ name?, slug?, facet?, display_order? }`. Partial update, validates slug uniqueness.

**`DELETE /api/admin/tags/[id]`**
Deletes the tag. Cascades via FK (article_tags and source_tags both have `ON DELETE CASCADE`).

**`POST /api/admin/tags/merge`**
Body: `{ sourceId: string, targetId: string }` — merge source into target.
```ts
// Reassign article_tags: upsert to avoid dup PK, then delete orphans
await supabase.from("article_tags")
  .upsert(rows.map(r => ({ ...r, tag_id: targetId })), { onConflict: "article_id,tag_id", ignoreDuplicates: true })
await supabase.from("article_tags").delete().eq("tag_id", sourceId)
// Same for source_tags
await supabase.from("source_tags")
  .upsert(rows.map(r => ({ ...r, tag_id: targetId })), { onConflict: "source_id,tag_id", ignoreDuplicates: true })
await supabase.from("source_tags").delete().eq("tag_id", sourceId)
// Delete the source tag
await supabase.from("tags").delete().eq("id", sourceId)
```

---

## Existing code reused vs built new

| | Reused | Built new |
|---|---|---|
| Auth client | `createClient()` from `src/lib/supabase/server.ts` | `src/lib/admin-auth.ts` wrapper |
| Existing admin route | `src/app/api/admin/article-tags/route.ts` stays (editor tool, separate concern) | 5 new routes under `/api/admin/` |
| Feed | Existing route, 2-line change | — |
| Dashboard styles | Tailwind patterns (zinc palette, same border/bg conventions) | Admin page layout |

---

## Admin page — `/admin`

### File structure

```
src/app/admin/
  layout.tsx        # server component: requireAdmin() → redirect if null
  page.tsx          # client component: tab state, fetches from admin APIs
```

### `layout.tsx` (server)

```tsx
import { requireAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }) {
  const user = await requireAdmin();
  if (!user) redirect("/");
  return <>{children}</>;
}
```

### `page.tsx` (client)

Single page, two tabs toggled with local state:

```
[Sources] [Tags]   ← tab buttons

Sources tab:
  Table: Name | Site URL | Articles | Last fetched | Hidden toggle
  Hidden toggle: a toggle button that fires PATCH /api/admin/sources/[id]
  Filter: "Show hidden only" checkbox

Tags tab:
  Table: Name | Slug | Facet | Articles | Actions
  Actions: Edit (inline form) | Merge (select target from dropdown) | Delete
  Edit: turns the row into an inline form with name/slug/facet inputs, save/cancel
  Merge: opens a small modal/dropdown: "Merge into: [tag picker]" → POST merge
  Delete: confirmation inline ("Are you sure? This removes N tag associations") → DELETE
```

No pagination needed initially — source count is small. Tags are also unlikely to exceed a few hundred.

---

## Build order (phases)

### Phase 1 — Schema + feed filter (30 min)
- Write `supabase/migrations/020_source_hidden.sql`
- Apply locally: `supabase db push`
- Add `.eq("hidden", false)` to both source queries in `/api/feed/route.ts`
- Test: verify feed still loads, hidden sources excluded

### Phase 2 — Admin API (45 min)
- Create `src/lib/admin-auth.ts`
- `src/app/api/admin/sources/route.ts` (GET) + `src/app/api/admin/sources/[id]/route.ts` (PATCH)
- `src/app/api/admin/tags/route.ts` (GET) + `src/app/api/admin/tags/[id]/route.ts` (PATCH, DELETE)
- `src/app/api/admin/tags/merge/route.ts` (POST)
- Add `ADMIN_EMAIL` to `.env.local`

### Phase 3 — Admin UI (60 min)
- `src/app/admin/layout.tsx` (server auth guard)
- `src/app/admin/page.tsx` (client, tabs, tables, inline actions)
- Smoke test: toggle a source hidden, verify it disappears from feed, un-hide it

### Phase 4 — Footer link (10 min)
- Issue #120 mentions a "Get your site removed" footer link → email contact
- Add to site footer component (wherever that lives) pointing to the contact email

---

## Out of scope

- Role system / multiple admins
- Audit log of admin actions
- Bulk operations (hide all from domain, etc.)
- Crowdsourced tag suggestions (#122 explicitly excludes)
- User-facing tag editing (#122 explicitly excludes)
