# RSSMag — Daily Snapshot Implementation Plan (v4)

> Supersedes v3 ("Model C"). Same model — daily frozen issue, never-repeat, numbered + dated. Fixes two build-breaking / data-corrupting flaws.

## v4 Fixes (vs v3)

| # | v3 flaw | v4 fix |
|---|---------|--------|
| C1 | `(reader)/page.tsx` + existing `page.tsx` both claim `/` → **build error**. Route group layout nests inside root which renders global chrome → reader can never be chrome-free | Root layout stripped to `<html><body>`. All existing routes + chrome moved into `(main)/` group. Old `page.tsx` deleted. `(reader)/page.tsx` cleanly owns `/` |
| C2 | Snapshot did separate `issues` insert + N `issue_articles` inserts → no transaction → **orphan empty issue** possible | Single Postgres RPC (`create_daily_issue`, SECURITY DEFINER) does everything in one transaction. Advisory lock for issue_number. Any failure = full rollback |
| S1 | Idempotency was plain SELECT (TOCTOU race) | `issues.date UNIQUE` + advisory lock + catch `23505` → treat as idempotent |
| S2 | Never-repeat only by article_id → same URL re-ingested as new row could repeat | Pool excludes every `link` present in any past `issue_articles` |
| S3 | Resume index into client array → editorial slots drifted | Page composition is a pure function of the issue payload: `composePages(issue, items) → Page[]` |
| S4 | Day-1 "zero everything" undefined | `/api/feed` empty response: `{issue: null, items: []}`, HTTP 200. Seed Issue #1 = hard launch gate |
| S5 | refreshStaleSources inside snapshot → slow/failing refresh blocks issue creation | Refresh runs separately at 23:55 UTC. Snapshot at 00:00 UTC. Decoupled |
| S6 | No explicit "apply migration" step | Migration apply = Task 3 |
| S7 | Sanitization hand-waved | ArticlePage delegates to existing `ArticleReader` DOMPurify |

## Route Structure

```
src/app/
  layout.tsx                 # ROOT — <html><body> only. No chrome, no auth.
  (main)/                    # public app WITH chrome (Header/Footer/BottomNav)
    layout.tsx               # getUser() + Header + Footer + BottomNav
    about/page.tsx
    login/page.tsx
    ...existing routes...
  (reader)/                  # RSSMag reader, NO chrome
    layout.tsx               # h-[100dvh] overflow-hidden bg-black
    page.tsx                 # "/" — today's issue
    issue/[number]/page.tsx  # "/issue/7" — archive
  admin/                     # standalone, under bare root layout
```

## Data Model

**Migration 022:** `issues` + `issue_articles` tables with RLS (public read, service role write), `uniq_article_one_issue` constraint.

**Migration 023:** `create_daily_issue(p_date, p_origin, p_article_ids)` — Postgres RPC, SECURITY DEFINER. One transaction: advisory lock → idempotency check → assign issue_number → insert issue row → insert all article rows. Any failure = full rollback. No orphan issues.

## Snapshot Job

`POST /api/issues/snapshot` — CRON_SECRET bearer auth. Algorithm:
1. Build eligible pool: sources NOT hidden, NOT blacklisted, articles NOT in any past issue (by link), deduped, newest-first
2. Interleave by source, take up to 20. Order = issue order.
3. Empty pool → return `{created: false, reason: "empty_pool"}`
4. Call RPC, catch 23505 → idempotent
5. Return `{created: true, issueNumber, date, count}`

**Crons:** 23:55 UTC refresh (existing POST /api/feed), 00:00 UTC snapshot.

## Feed API

`GET /api/feed` → today's issue. `GET /api/feed?issue=7` → archive. Returns `{issue: {number, date, count, origin, isToday}, items: [...articles with full content and tags]}`. Empty day: `{issue: null, items: []}`.

## Reader

`(reader)/page.tsx` fetches today's issue, builds page array via `composePages()`:

```
Cover → Context → [articles, Section every 5, Editor at floor(count/2)] → Closing
```

- **Resume:** localStorage `{issueNumber, index}`, self-invalidating on number change
- **Empty:** "Today's issue is still being assembled."
- **Sanitization:** ArticlePage delegates to existing `ArticleReader` (DOMPurify)
- **Section pages:** real topic slugs from this issue's tags (facet=topic)
- **Dynamic counts:** all copy reads from `issue.count`, no hardcoded 20

## Tasks

| # | Task | Type |
|---|------|------|
| 1 | Spike: Embla vs Swiper for swipe stack with nested scroll | spike |
| 2 | Migrations 022 + 023 | build |
| 3 | Apply migrations to DB | build |
| 4 | Route restructure (root → shell, (main)/ group, (reader)/ group, delete old page.tsx) | build |
| 5 | POST /api/issues/snapshot | build |
| 6 | Crons: 23:55 refresh, 00:00 snapshot | build |
| 7 | Rework GET /api/feed → frozen issue + empty shape | modify |
| 8 | (reader)/page.tsx + IssueReader + localStorage resume | build |
| 9 | SwipeStack component | build |
| 10 | composePages() + all 6 page components | build |
| 11 | Empty-state page | build |
| 12 | Archive scaffold /issue/[number] | scaffold |
| 13 | Remove dead reader code | cleanup |
| 14 | (Optional) remount discovery at (main)/discover | build |
| 15 | npm run build (confirms no / route collision) | verify |
| 16 | Seed Issue #1 — hard launch gate | verify |
| 17 | Idempotency + race test | verify |
| 18 | Verify /admin still works | verify |
| 19 | iOS Safari QA | verify |

## Order

```
Phase 1 — ADMIN + PIPELINE (no reader UI touched)
  A1 — Spike: Embla vs Swiper (1)
  B1 — DB + RPC + apply (2-3)
  C1 — Route restructure: root layout shell, (main)/ group, (reader)/ group shell, 
       delete old page.tsx — BUT (reader)/page.tsx renders placeholder only (4, 15)
  D1 — Snapshot + crons (5-6)
  E1 — Feed API rework (7)
  F1 — Seed Issue #1 manually after Max approves sources (16)
  G1 — Verify admin panel fully functional: source management, tag management,
       approval workflow, hide/delete/blacklist (18)

Phase 2 — READER (build after admin + pipeline are solid)
  H2 — IssueReader + localStorage resume (8)
  I2 — SwipeStack component (9)
  J2 — composePages() + all 6 page components (10)
  K2 — Empty-state page (11)
  L2 — Archive scaffold (12)

Phase 3 — CLEANUP + QA
  M3 — Remove dead reader code (13)
  N3 — (Optional) remount discovery at (main)/discover (14)
  O3 — Idempotency + race test (17)
  P3 — iOS Safari QA (19)
```

**Phase 1 gate:** Max approves sources → snapshot creates Issue #1 → `/api/feed` returns real articles. Admin verified working. Then Phase 2 begins.

**Phase 2 gate:** Reader at `/` shows Cover → Context → real articles → Closing. Build passes. Then Phase 3 begins.
