# Discovery Pivot — Implementation Plan
**Date:** 2026-07-23  
**Status:** Draft

---

## Overview

Transform Internet Curators from an editorial-curators-first platform into a public discovery feed where anonymous users scroll and read, and logged-in users vote/save/dismiss to shape the firehose. The RSS ingestion pipeline, tag taxonomy, Supabase backend, and exclusion logic stay entirely intact. We're building a new consumer-facing shell on top.

---

## Phase 0 — Remove Editorial Pipeline

Before building anything new, strip the editorial pipeline. Dead code is cleanup debt.

### Files/routes to DELETE:
```
src/app/review-queue/page.tsx
src/app/review/[id]/page.tsx
src/app/api/review/** (all review API routes)
src/components/ReviewSection.tsx
src/components/SourceReviewCard.tsx
src/components/ReviewDetailClient.tsx
src/app/reader/** (old reader — rebuilt as /article/[id])
```

Remove `ReviewSection` references from any shared layout files and navigation.

### What Stays Untouched

| Existing piece | Why |
|---|---|
| `feed-refresher.ts` RSS ingestion | Core data pipeline, fully reused |
| `articles` + `sources` + `tags` tables | Data layer unchanged |
| `article_tags` + `source_tags` keyword matching | Tag system works as-is |
| `article_votes` table + `apply_vote` RPC | Keep for aggregate counts; extend with user-level layer |
| `/api/feed` endpoint | Reused with minor additions |
| `/api/tags` endpoint | Unchanged |
| `/api/votes` GET (aggregate counts) | Unchanged |
| `supabase/client.ts`, `server.ts`, `service.ts` | Auth plumbing stays |
| `useAuth.ts` hook | Reused |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` pages | Already exist, keep |
| Collections, curator, follows, dashboard routes | V2 — left dormant, don't touch |
| `FiltersBar.tsx` | Adapted (see Phase 3) |
---

## 1. Database Changes

### Migration 018 — `user_article_actions`

Replaces client-side localStorage for vote/save/dismiss with server-persisted, per-user state. Anonymous aggregate counts continue to live in `article_votes` (already updated by `apply_vote` RPC).

```sql
-- 018_user_article_actions.sql

create table if not exists user_article_actions (
  user_id    uuid    not null references auth.users on delete cascade,
  article_id uuid    not null references articles(id) on delete cascade,
  action     text    not null check (action in ('upvote', 'downvote', 'save', 'dismiss')),
  created_at timestamptz not null default now(),
  primary key (user_id, article_id, action)
);

-- Only the owning user can read/write their own actions
alter table user_article_actions enable row level security;

create policy "users manage own actions"
  on user_article_actions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fetching all actions for a user across a batch of articles
create index user_article_actions_user_articles
  on user_article_actions (user_id, article_id);
```

**Notes:**
- `upvote` and `downvote` are **mutually exclusive**: the API must DELETE the opposite action before INSERTing a new one. Toggle behavior: if the same action already exists, DELETE it (un-vote).
- `save` and `dismiss` are independent and can coexist with votes.
- When a user votes, the existing `apply_vote` RPC still fires to keep `article_votes` aggregate counts accurate.

### No other schema changes needed.

The `articles` table already has `id`, `source_id`, `title`, `link`, `pub_date`, `image`, `content_snippet`, `content`. The `sources` table has `id`, `title`, `site_url`, `feed_url`. Tag facets (`topic`, `voice`) already exist. All feed query infrastructure is already in `/api/feed`.

---

## 2. New API Endpoints

### `POST /api/actions`
Records a user action (vote/save/dismiss) on an article. Requires auth — returns 401 otherwise (this is the login gate trigger).

**Request body:**
```json
{ "articleId": "uuid", "action": "upvote" | "downvote" | "save" | "dismiss", "articleLink": "string" }
```

**Logic:**
1. Get `user_id` from session; return 401 if not authenticated.
2. If `action` is `upvote` or `downvote`: DELETE the opposite action if it exists, then toggle (if same action already exists, DELETE it; otherwise INSERT).
3. When toggling a vote, call `apply_vote` RPC with the correct `prev`/`next` delta to keep `article_votes` consistent.
4. For `save` / `dismiss`: toggle (DELETE if exists, INSERT if not).
5. Return `{ action, state: "added" | "removed" }`.

### `GET /api/actions?articleIds=uuid,uuid,...`
Returns the current user's action state for a batch of articles. Used when the feed loads to hydrate button states.

**Response:**
```json
{
  "abc-uuid": ["upvote", "save"],
  "def-uuid": ["dismiss"]
}
```

Returns `{}` for unauthenticated users (client renders default states).

### `GET /api/saved`
Returns the full list of articles the authenticated user has saved, with full article data joined from `articles` + `sources`. Requires auth.

### Existing endpoints to modify:

**`/api/feed`** — add `articleId` to every returned item (currently only `link` is returned; the actions API needs `article_id` to look up `user_article_actions`). The `articles.id` is already in the DB; just include it in the SELECT.

**`/api/votes` POST** — keep as-is; it continues to be called by the new actions endpoint for the aggregate side-effect.

---

## 3. New Pages & Routes

### `/` — Landing Page (overhaul `src/app/page.tsx`)

The current `page.tsx` renders the discover/my-feed tab system directly. Replace it with a **two-section scroll page**:

**Section 1 — Hero (above the fold):**
- Logo top-left, "Sign In" button top-right (links to `/login`)
- "Free your feed" headline (large, left-aligned)
- One-line subhead: tagline
- "Learn more ›" text link (smooth-scrolls to Section 2)
- "↓ Scroll down" sticky bottom prompt (fades out after first scroll)

**Section 2 — Discovery Feed (below the fold, same page):**
- Transitions into the feed when the user scrolls past the hero
- TOPIC + VOICE filter chips at top (sticky)
- Infinite scroll article cards
- "Top Sources" section injected after ~10 articles (see Section 5)

**Implementation note:** This is a single-page scroll, not a route change. Use `useRef` + `IntersectionObserver` to detect when the user has scrolled into the feed section, at which point the header/nav appearance changes.

**Existing code reused:** The fetch logic in the current `page.tsx` (feed fetch, loadMore, filteredItems) moves nearly verbatim into the new feed section component.

---

### `/article/[id]` — Article Read View (new route)

The current `/reader` route receives article data as URL search params, which breaks on long content and is not linkable. Replace with a proper dynamic route backed by the `articles` table.

**URL structure:** `/article/[id]` where `id` is `articles.id` (UUID).

**Page behavior:**
- Server component fetches article by ID, joins source name and tags.
- Renders a clean reader: source badge, title, image (full-width), content (sanitized HTML or snippet).
- **Persistent bottom action bar** (fixed, above device chrome):
  - ↑ Upvote (with count)
  - ↓ Downvote (with count)
  - + Save (bookmark icon)
  - ø Dismiss (slash/circle icon)
  - Any tap → auth check → redirect to `/login?next=/article/[id]` if not logged in
- Back arrow (top-left) → returns to feed
- External link icon (top-right) → opens `article.link` in new tab

**Components needed:**
- `ArticleActionBar.tsx` — the fixed bottom bar (client component)
- `ArticleReader.tsx` — content display (server-rendered HTML with DOMPurify on client)

**Existing code reused:** DOMPurify is already installed. The reader layout in `/reader/page.tsx` can be referenced for the content sanitization pattern.

---

### `/saved` — Saved Articles (new route)

Shows all articles the logged-in user has saved, newest first.

- Requires auth: if not logged in, redirect to `/login?next=/saved`.
- Empty state: "Nothing saved yet. Browse the feed to find articles."
- Article cards with same layout as feed but with a "Remove" action instead of Save.

**Bottom tab:** This is the "bookmarks" tab in the new nav.

---

### `/source/[id]` — Source Detail Page (existing route, redesign)

Route already exists. Current implementation uses curator/collection framing. Redesign:

- Back arrow (top-left)
- Source name (large), description, site URL
- Source favicon/logo if available
- Most recent articles from this source (reuse feed card layout)
- No editorial controls visible

**Existing code partially reused:** The route handler at `src/app/source/[id]/page.tsx` fetches source data — keep the data fetching, replace the render.

---

### `/profile` — Profile Page (existing, minor update)

Already exists. Only change: update bottom nav to point here as the "person" tab. No functional changes.

---

## 4. Component Changes

### `BottomNav.tsx` — Replace

Current nav has: Discover | My Feed | Search.  
New nav: Browse (globe) | Saved (bookmark) | Profile (person).

```
Tab       Icon       Route       Active when
Browse    globe      /           pathname === "/"
Saved     bookmark   /saved      pathname === "/saved"
Profile   person     /profile    pathname === "/profile"
```

The nav should be visible on `/`, `/saved`, `/profile`, and `/article/[id]`.

### `ArticleCard.tsx` — Extend (don't rewrite)

Current card has vote/hide/remove in an actions row. The card in the new feed still shows:
- Image (already there)
- Source badge (already there)  
- Tags (topic + voice, already there)
- Title (already there)
- Snippet (already there)
- Actions row: ↑ upvote count · ↓ downvote count · + save · ø dismiss

Changes needed:
1. Add `articleId: string` prop alongside existing `item`.
2. Replace the local `handleVote` localStorage logic with a call to `POST /api/actions`. Keep optimistic UI (update counts immediately, rollback on error).
3. Add `onSave` and `onDismiss` handlers that also call `POST /api/actions`.
4. Add `userActions: string[]` prop (populated from `GET /api/actions` response) to show active state on buttons.
5. Auth gate: if the user is not logged in, the action buttons redirect to `/login?next=<current-url>` instead of firing the API call. Pass an `isLoggedIn: boolean` prop.
6. Remove the "add source to my collection" button (the `showAddSource` prop path) — this is a curator feature, not relevant to the discovery feed.
7. Clicking the article title/image navigates to `/article/[id]` (not `/reader?...`).

The `compact` variant can stay (may be used in V2 dashboard). Remove `onRemoveSource`/hide menu — the editorial pipeline it served is gone.

### `FiltersBar.tsx` — Adapt

Current implementation reads URL params (`?tags=`) and fetches all tags by facet. For the new feed:
- Show only **TOPIC** and **VOICE** facets as chip groups (already the most prominent facets).
- Style as dropdown/chip selectors matching the wireframe ("Topic ▾" and "Voice ▾").
- Keep the URL param approach (`?tags=`) — the `/api/feed` endpoint already handles this.

Minimal code change: filter the displayed facets to `['topic', 'voice']` and update chip styling.

### New: `AuthGate.tsx`

A thin client component that wraps any auth-required action. Accepts a `fallback` redirect path. If `isLoggedIn` is false, pushes to `/login?next={fallback}` and optionally shows a toast: "Sign in to save articles."

### New: `TopSources.tsx`

A horizontal scroll section injected into the feed after ~10 articles.
- Heading: "Top Sources"
- Horizontally scrollable source cards: favicon/initial, source name, short description
- Tapping a card navigates to `/source/[id]`
- Data: query `sources` table ordered by join between `article_votes` aggregates (or just most-followed / most-articles). Start simple: sources with the most articles in the last 30 days.
- New API endpoint: `GET /api/sources/top?limit=10` — returns sources ordered by recent article count.

### New: `ArticleActionBar.tsx`

Fixed bottom bar for the article read view. Props: `articleId`, `articleLink`, `upvotes`, `downvotes`, `userActions`, `isLoggedIn`. Calls `POST /api/actions` on tap. Shows active state for each action.

---

## 5. Auth Implementation

### What's already there

- `src/app/login/page.tsx` — email/password login form ✓
- `src/app/signup/page.tsx` — signup form ✓  
- `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx` ✓
- `src/app/api/auth/callback/route.ts` — OAuth callback ✓
- `src/app/api/auth/signout/route.ts` ✓
- `src/hooks/useAuth.ts` — client-side auth state ✓
- `src/lib/supabase/client.ts` + `server.ts` — Supabase clients ✓

### What's needed

1. **Login page polish**: Ensure the existing `/login` form matches the wireframe (email field, password field, submit button, "Sign up" link below). Currently this exists — verify styling is clean for the new consumer context.

2. **`?next=` redirect param**: After sign-in or sign-up, redirect to the page that triggered the login gate. Check if this is already handled in the callback route; if not, add it.

3. **Auth state in feed**: The home page needs to know `isLoggedIn` to pass into `ArticleCard`. Use `useAuth()` hook (already exists). On the server-rendered article page, use the server Supabase client to check session.

4. **`/saved` route guard**: Use Next.js middleware or a server-side redirect at the top of the page if `!user`.

---

## 6. Voting / Signal System Design

### Current state

- `article_votes` table: keyed by `link`, stores `upvotes` / `downvotes` aggregate counts.
- `apply_vote` Postgres RPC: handles delta transitions (`prev` → `next`) atomically.
- Client tracks vote state in localStorage (`ic:votes`).

### New system

Keep the existing aggregate table and RPC. Layer on top:

```
User taps ↑ on an article
  └─► POST /api/actions { articleId, action: "upvote", articleLink }
        ├─ Check auth → 401 if not logged in
        ├─ Read current row from user_article_actions
        ├─ If "upvote" exists: DELETE it, call apply_vote(prev=1, next=0)   → un-vote
        │  If "downvote" exists: DELETE it, then INSERT "upvote", call apply_vote(prev=-1, next=1)
        │  If neither exists: INSERT "upvote", call apply_vote(prev=0, next=1)
        └─ Return { action: "upvote", state: "added" | "removed" }
```

The `article_votes` aggregate stays consistent because every user action still calls `apply_vote`. Anonymous users can no longer vote (votes require auth). The aggregate counts remain publicly readable for display.

**Migration note:** Existing vote counts in `article_votes` are already there from anonymous voting. They stay. New votes from logged-in users will add to them. No data loss.

**Dismiss signals:** `dismiss` actions on `user_article_actions` are not surfaced publicly — they're used only to filter the feed for the dismissing user. In a later iteration, aggregate dismiss counts could inform ranking, but not in this plan.

---

## 7. Feed Filtering for Dismissed Articles

When the feed loads for a logged-in user, dismissed articles should be hidden. Two approaches:

**Option A (server-side):** Modify `/api/feed` to accept a `userId` (derived from session), query `user_article_actions` for `action = 'dismiss'`, and exclude those `article_id`s from results.

**Option B (client-side):** After loading feed, fetch `GET /api/actions?articleIds=...` for the batch, then filter out dismissed ones on the client.

**Recommendation: Option B for now.** It avoids modifying the feed endpoint and the dismiss list per user will be small initially. Revisit to Option A when dismiss counts grow large enough to matter for performance.

---

## 8. Recommended Build Order

### Phase 0 — Remove Editorial Pipeline (before anything else)

Delete the following files outright — they have no role in the consumer product and are not planned V2 features.

**Routes:**
- `src/app/review-queue/page.tsx` — editorial review queue
- `src/app/review/[id]/page.tsx` — individual article review page
- `src/app/reader/page.tsx` — old reader (URL-param-based, not linkable; replaced by `/article/[id]`)

**Components:**
- `src/components/ReviewSection.tsx`
- `src/components/SourceReviewCard.tsx`
- `src/components/ReviewDetailClient.tsx`

**Note on `/reader`:** Data arrived via URL search params — there is no stable public URL surface to preserve. No redirect needed; just delete.

**Deliverable:** No dead routes or components in the repo. All remaining dormant code is intentionally parked V2 work.

---

### Phase 1 — Foundation (no visible changes to users)
1. Write migration `018_user_article_actions.sql` and apply it.
2. Add `articleId` to the `/api/feed` response (add `articles.id` to the SELECT in the feed query).
3. Build `POST /api/actions` and `GET /api/actions` endpoints.
4. Build `GET /api/saved` endpoint.
5. Verify auth middleware flow with `?next=` redirect.

**Deliverable:** Backend is ready. No UI changes yet.

---

### Phase 2 — Landing Page
1. Replace `src/app/page.tsx` hero section with "Free your feed" layout.
2. Implement smooth-scroll to feed section.
3. Add "↓ Scroll down" prompt with fade-out on scroll.
4. Update `BottomNav.tsx` to Browse / Saved / Profile tabs.
5. Update `Header.tsx` to show "Sign In" button for anonymous users.

**Deliverable:** Landing page with scroll-to-feed, new nav shape.

---

### Phase 3 — Discovery Feed
1. Adapt `FiltersBar.tsx` to show only Topic + Voice chips.
2. Update `ArticleCard.tsx`: add `articleId` prop, wire actions to `POST /api/actions`, add auth gate, navigate to `/article/[id]`.
3. Move feed fetch logic from current `page.tsx` into a new `DiscoverFeed.tsx` client component.
4. Inject `TopSources.tsx` section after 10th article.
5. Build `GET /api/sources/top` endpoint.

**Deliverable:** Full scrollable feed with filter chips and auth-gated actions.

---

### Phase 4 — Article Reader
1. Create `src/app/article/[id]/page.tsx` (server component, fetches from `articles` table by UUID).
2. Build `ArticleActionBar.tsx` (fixed bottom bar).
3. Build `ArticleReader.tsx` (sanitized content render).
4. Wire auth gate on action bar buttons.
5. The old `/reader` route is deleted in Phase 0; no redirect needed (URL-param-based, no stable links to preserve).

**Deliverable:** Clean article read view with persistent action bar.

---

### Phase 5 — Saved Feed + Profile
1. Create `src/app/saved/page.tsx` — fetches from `GET /api/saved`, renders article cards.
2. Add route guard (redirect to login if not authenticated).
3. Update `/profile` page — minimal changes, just ensure bottom nav points here.
4. Wire dismiss filtering: after feed load, fetch user actions, hide dismissed articles.

**Deliverable:** Complete tab bar flow. Core product is shippable.

---

### Phase 6 — Source Detail Page
1. Redesign `src/app/source/[id]/page.tsx` — clean layout per wireframe.
2. Source name, description, link out to site.
3. Recent articles from this source using existing `/api/feed?sourceId=` (or add `sourceId` param if not present).
4. Back arrow navigation.

**Deliverable:** Source detail page accessible from TopSources cards and article source badges.

---

## 9. Decisions & Constraints

| Decision | Choice | Rationale |
|---|---|---|
| Vote auth requirement | Votes require login | Matches wireframe annotation; prevents spam; aligns with "any action other than reading requires auth" |
| Article URL scheme | `/article/[id]` (UUID) | Linkable, stable, server-renderable; URL params don't scale to full article content |
| Dismiss filtering | Client-side for now | Avoids modifying feed endpoint; revisit when dismiss counts are large |
| Aggregate vote counts | Keep `article_votes` + RPC | No data migration needed; per-user layer added on top |
| "My Feed" / curator follows | Dormant | Not in scope; the tab is removed from bottom nav |
| Collections / curator identity | V2 | Routes stay dormant, no removal |
| Editorial pipeline | Removed | Dead code, not V2 features — deleted in Phase 0 |
| Landing page vs separate browse route | Single page scroll | Matches wireframe; simpler than two routes |

---

## 10. Files Changed / Created Summary

### New files
```
supabase/018_user_article_actions.sql
src/app/article/[id]/page.tsx
src/app/saved/page.tsx
src/app/api/actions/route.ts
src/app/api/saved/route.ts
src/app/api/sources/top/route.ts
src/components/ArticleActionBar.tsx
src/components/ArticleReader.tsx
src/components/AuthGate.tsx
src/components/TopSources.tsx
src/components/DiscoverFeed.tsx
docs/plans/2026-07-23-discovery-pivot.md  ← this file
```

### Modified files
```
src/app/page.tsx           — replace with landing hero + scroll-to-feed
src/app/source/[id]/page.tsx   — redesign layout
src/app/api/feed/route.ts      — add articles.id to response
src/components/ArticleCard.tsx — add articleId, auth gate, actions API, /article/[id] nav
src/components/BottomNav.tsx   — new tabs: Browse / Saved / Profile
src/components/FiltersBar.tsx  — limit to topic + voice facets
src/app/login/page.tsx         — add ?next= redirect support
```

### Untouched (dormant — V2 features, not dead code)
```
src/app/dashboard/**
src/app/api/collections/**
src/app/api/curators/**
src/app/api/follows/**
src/app/api/discover/**
src/components/CuratorStrip.tsx
src/components/CuratorCard.tsx
src/components/CuratorStories.tsx
```

### Removed (Phase 0 — editorial pipeline)
```
src/app/review-queue/page.tsx
src/app/review/[id]/page.tsx
src/app/reader/page.tsx
src/components/ReviewSection.tsx
src/components/SourceReviewCard.tsx
src/components/ReviewDetailClient.tsx
```
