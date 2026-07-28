# RSSMag — Daily Snapshot Implementation Plan (v5)

> Supersedes v4. Same Model C — daily frozen issue, never-repeat, numbered + dated. Fixes build order (leaves-first), drops Section filtering from Phase 2, adds gesture strategy, caching, and v4 review findings.

## v5 Changes (vs v4)

| # | v4 | v5 |
|---|-----|-----|
| B1 | Build order: IssueReader → SwipeStack → page components | Leaves-first: composePages() types → page components → SwipeStack → IssueReader → page.tsx |
| S1 | Section pages: tap topic → filter stack | Section pages: purely informational (display topics). Filtering contradicts the frozen snapshot model |
| S2 | Closing + Ending as separate pages | Merged into one Closing card |
| S3 | No gesture strategy specified | `touch-action: pan-y` on Embla container + `watchDrag` with angle detection (>30° from horizontal = browser scroll) |
| S4 | No cache strategy | `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` on /api/feed |
| S5 | SSR resume not addressed | `scrollTo(savedIndex, true)` for instant jump, no flash |
| S6 | Image layout shift not addressed | Fixed aspect-ratio containers on article images |
| S7 | Editor page: hardcoded | Read editor name/note from config/env |
| S8 | Section cadence at tail not handled | Clamp: suppress final Section if < 3 articles remain after it |
| S9 | contentSnippet sanitization not addressed | Sanitize contentSnippet before rendering (can contain HTML from feed parser) |
| S10 | No `published` field in feed response | Add `published` to IssueResponse type (used by admin) |

## Route Structure (unchanged from v4)

```
src/app/
  layout.tsx                 # ROOT — <html><body> only. No chrome, no auth.
  (main)/                    # public app WITH chrome (Header/Footer/BottomNav)
    layout.tsx               # getUser() + Header + Footer + BottomNav
    ...existing routes...
  (reader)/                  # RSSMag reader, NO chrome
    layout.tsx               # h-[100dvh] overflow-hidden bg-black
    page.tsx                 # "/" — today's issue (thin shell, calls IssueReader)
    issue/[number]/page.tsx  # "/issue/7" — archive
  admin/                     # standalone, under bare root layout
```

## Data Model (unchanged from v4)

- `issues` table: id, issue_number (numeric 10,1), date, origin, published, created_at
- `issue_articles` junction: issue_id, article_id, position. UNIQUE(article_id) = never-repeat
- `create_daily_issue(p_date, p_origin, p_article_ids)` RPC — atomic, advisory lock, idempotent
- 0.x numbering for test phase (increment by 0.1), switch to +1 when live

## Feed API (unchanged from v4)

`GET /api/feed` → today's issue. `GET /api/feed?issue=N` → archive.

**v5 addition:** `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` on the response.

## Reader Architecture

### composePages(issue, items) → Page[]

Pure function. Deterministic. Given an issue payload and items array, returns the complete page stack:

```
Cover → Context → [Article ×5] → Section → [Article ×5] → Editor → [Article ×5] → Section → [Article ×5] → Closing
```

**Section cadence rules:**
- Section page after every 5 articles
- Editor page at `floor(count/2)` position in the article sequence
- Suppress final Section page if fewer than 3 articles remain after it
- Article count (`issue.count`) drives all copy — no hardcoded "20"

**Page type union:**
```ts
type Page = 
  | { type: "cover" }
  | { type: "context" }
  | { type: "article"; item: FeedItem }
  | { type: "section"; topics: Tag[] }
  | { type: "editor" }
  | { type: "closing"; count: number };
```

**Section pages are informational only.** They display the topics present in this issue's articles (facet=topic). No tap-to-filter. Filtering contradicts the frozen snapshot model — a fixed 20-article stack can't reorganize mid-session without breaking the ending and localStorage resume.

### SwipeStack Component

Embla Carousel wrapper. One slide per page in the stack.

```tsx
<SwipeStack pages={pages} startIndex={savedIndex} onIndexChange={handleIndexChange} />
```

**Gesture strategy:**
```
Embla container: touch-action: pan-y, overflow: hidden
  └── Each slide: h-[100dvh] overflow-y-auto for articles
```

- `touch-action: pan-y` tells browser: vertical scroll is yours, don't surrender to JS
- `watchDrag` predicate: compute movement angle from touchstart. If within 30° of horizontal → Embla takes it + `preventDefault()`. Otherwise → browser scrolls
- Test on iOS Safari early (not left to Phase 3 QA)

### IssueReader Component

`'use client'`. Fetches `/api/feed`, calls `composePages()`, manages localStorage resume.

```
localStorage key: "rssmag-resume"
Value: { issueNumber: number, index: number }
Self-invalidates when issueNumber changes.
On resume: scrollTo(savedIndex, true) — instant, no animation flash.
```

### Individual Page Components

| Page | Component | Key behaviors |
|------|-----------|---------------|
| Cover | `CoverPage` | Mag name, one-liner, subtle swipe hint (arrow/indicator) |
| Context | `ContextPage` | Editorial stance text, one screen |
| Article | `ArticlePage` | Full-screen. Title, aspect-ratio image container, content via DOMPurify, source link. `overflow-y-auto` for long content. `contentSnippet` sanitized before render |
| Section | `SectionPage` | Lists topic tags from this issue. Informational only — no tap interaction in Phase 2 |
| Editor | `EditorPage` | Face, name, note. Read from config/env, not hardcoded |
| Closing | `ClosingPage` | Editor note, "get in touch" link, GitHub link, "come back tomorrow." Designed ending |

## Tasks (v5)

| # | Task | Type | Depends on |
|---|------|------|------------|
| 1 | Define Page type union + composePages() function | types | — |
| 2 | CoverPage component | build | 1 |
| 3 | ContextPage component | build | 1 |
| 4 | ArticlePage component | build | 1 |
| 5 | SectionPage component | build | 1 |
| 6 | EditorPage component | build | 1 |
| 7 | ClosingPage component | build | 1 |
| 8 | SwipeStack component (Embla + gesture strategy) | build | 1 |
| 9 | IssueReader component (fetch + compose + localStorage) | build | 1, 8 |
| 10 | Rewrite (reader)/page.tsx (thin shell → IssueReader) | modify | 9 |
| 11 | Empty-state page (issue is null → "still being assembled") | build | 10 |
| 12 | Archive scaffold /issue/[number] | scaffold | 10 |
| 13 | Cache-Control headers on /api/feed | modify | — |
| 14 | Add `published` to IssueResponse type | modify | — |
| 15 | npm run build | verify | all |
| 16 | iOS Safari QA (especially gesture conflict) | verify | 8 |

## Build Order

```
Phase 2a — FOUNDATIONS (parallel-safe)
  A1 — Page type union + composePages() (1)
  A2 — Cache-Control + published field (13-14) — parallel with A1

Phase 2b — PAGE COMPONENTS (all parallel, different files)
  B1 — CoverPage (2)
  B2 — ContextPage (3)
  B3 — ArticlePage (4)
  B4 — SectionPage (5)
  B5 — EditorPage (6)
  B6 — ClosingPage (7)

Phase 2c — WIRING (sequential)
  C1 — SwipeStack with gesture strategy (8)
  C2 — IssueReader (9)
  C3 — Rewrite page.tsx (10)
  C4 — Empty-state (11)
  C5 — Archive scaffold (12)

Phase 2d — VERIFY
  D1 — npm run build (15)
  D2 — iOS Safari QA (16)
```

**Phase 2 gate:** Reader at `/` shows Cover → Context → real articles → Closing. Build passes. Then Phase 3 (cleanup) begins.

## Out of Scope (Phase 2)

- Section page tap-to-filter (contradicts frozen snapshot model — revisit as separate feature)
- Article action buttons (save, share — future dossier phase)
- User accounts or auth in reader
- Personalization or algorithmic ordering
- Multiple editors (one editor config for now)
