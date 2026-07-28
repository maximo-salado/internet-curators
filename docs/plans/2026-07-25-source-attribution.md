# Source Attribution — Transparency Spec
**Date:** 2026-07-25
**Status:** Deprecated — superseded by swipe-reader pivot (July 27, 2026)

---

## What

Every source shows who vouched for it and where it was found. An info icon on the source detail page exposes the full provenance. Two paths, one truth per source.

## How it looks

### Info icon on source page

Small `ⓘ` icon near the source name. Tap reveals a sheet:

**AI-discovered → editor-approved:**

```
Source: Maciej Cegłowski's Blog
Approved by: Maximogomez, Jul 28, 2026
Found by AI at: feedle.world
```

**Human-added directly:**

```
Source: Maciej Cegłowski's Blog
Added by: UserName, Jul 28, 2026
```

**Legacy (pre-migration):** no icon, nothing shown. These predate attribution tracking.

## How data flows

### Path A: AI discovery → human approval

```
Cron → discovered_sources (discovery_origin='ai', discovery_source='feedle.world', discovery_url='...')
         ↓
Editor approves → sources (attribution copied from discovered_sources, approved_by set)
```

### Path B: Human direct add

```
User → POST /api/sources → sources (discovery_origin='user', added_by=curator.id)
```

No overrides. No cross-row mutation. A source has exactly one provenance story, set when it enters `sources`.

## DB changes

### New columns on `sources`

| Column | Type | Purpose |
|---|---|---|
| `discovery_origin` | text | `'ai'` or `'user'` or null (legacy) |
| `discovery_source` | text | Human-readable origin name, e.g. `'feedle.world'`, `'searchmysite.net'`, `'blogroll.org'` |
| `discovery_url` | text | Link to the exact directory/search result page |
| `approved_by` | uuid | FK → `curators.id` — set when editor approves from discovered_sources |

### New columns on `discovered_sources`

| Column | Type | Purpose |
|---|---|---|
| `discovery_source` | text | Origin name for copy to sources at approval time |

Existing `discovered_at` on `discovered_sources` is the "first seen" date. `sources.created_at` remains the "entered sources" date (approval date or add date). No new date column needed — these already cover both semantics.

### Migration

One migration: add columns to both tables. Backfill approved sources by joining `discovered_sources` on `feed_url`. Legacy sources get `discovery_origin = null`.

## Privacy

- Cron-discovered sources show: "Found by AI at feedle.world" (directory name, never a person)
- Human-added sources show: "Added by a user, Jul 28, 2026" (anonymous, no name)
- No curator names displayed publicly. No opt-in complexity.

## Approval flow (when pipeline is re-enabled)

When an editor approves a source from `discovered_sources` to `sources`:

1. Copy `discovery_origin`, `discovery_source`, `discovery_url` from `discovered_sources`
2. Set `approved_by` to the approving editor's curator ID
3. `sources.created_at` = approval timestamp

## Frontend

- Source detail page (`/source/[id]`): `ⓘ` icon → sheet with provenance text
- Admin panel: show `discovery_origin`, `discovery_source` in sources table
- Direct add UI: a note "Sources you add show 'Added by you' on their page" if `public_display` is enabled for that curator

## Out of scope

- Re-enabling the editorial approval pipeline (separate plan)
- Editing attribution after creation
- Attribution on article cards (sources only)
- Same-feed cross-collection dedup (multiple sources rows for one feed is a broader issue)
