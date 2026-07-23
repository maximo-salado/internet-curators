# Internet Curators — Project Log

## 2026-07-23 — Trust Signals + Tag System Refactor + Review UX

Agent stack: Hermes (orchestration), OpenCode Go (code), Claude Sonnet (review)
PRs: #TBD
Issues: #99-#109

### What was built

**Backend: Trust signal detection**
- `src/lib/trust-signals.ts` — fetches homepage HTML, detects 7 trust badges via regex (C2PA, Trust Project, JTI, IFCN, CC, Not by AI, IndieWeb)
- SSRF-safe with private IP blocking, 8s timeout, 2MB body cap
- Detects platform (12 values) and no-trackers status
- Returns tag slugs for unified taxonomy

**Backend: Tag system refactor**
- `discovered_source_tags` junction table (016 migration)
- New tag facets: `trust`, `infra`, `platform`
- ~30 seed tags (017 migration + backfill)
- Enrich endpoint writes to `discovered_source_tags` instead of jsonb
- `update_tags` PATCH action with split-brain fix (writes to source_tags if approved)
- `_manual_overrides` jsonb removed — `edited_by` is the audit trail

**Frontend: Review UX redesign**
- `/review/[id]` — editor detail page with 8 collapsible sections (Topic, Stance, Format, Trust, Infra, Platform, Language, Posts)
- All sections use TagSelector — same UI, same data model
- Save/Cancel persist all edits; terminal actions auto-save before executing
- Review queue: clean list cards with tag pills, links to detail page
- Window focus re-fetch after navigation back from detail

### Design decisions
- All tags are public-read — readers see trust/infra/platform tags on source profiles
- `has-trackers` stays as jsonb boolean (detection fact, not a tag); only `no-trackers` is a tag
- CC license variant flattened to "Creative Commons" tag (license name enough)
- `editorial_standards_url` remains in jsonb (URL, not a tag)
- Non-atomic delete-then-insert documented as acceptable for single-editor workflow

### Claude reviews applied
- Round 1: Two-tier badge system, sort not filter, override audit trail
- Round 2: Sequential→parallel enrichment, client state sync, editor role check
- Round 3: Approve dedup, error capture, has_trackers coercion
- Round 4: Auth ordering, toast labels, aria, queue refresh on focus

## 2026-07-15 — Claude Code Security Audit

Agent: Claude Sonnet (Max subscription)
Scope: Full src/, supabase/migrations/, config files
Result: 26 issues (4 critical, 5 high, 9 medium, 8 low)

### Critical
- C1: Vote inflation via unvalidated prev/next in /api/votes
- C2: RLS allows anonymous INSERT/UPDATE on article_votes
- C3: articles INSERT policy open to all roles (should be service_role only)
- C4: SSRF via unvalidated RSS feed_url (can hit internal IPs)

### High
- H1: Follower count race condition (read-then-write)
- H2: Open redirect on auth callback next param
- H3: Signout redirects to Supabase URL, not app URL
- H4: OPML import no size/count limits, stores unvalidated URLs
- H5: @ts-nocheck + service-role client exposed in public feed GET

### Medium
- M1: Vote count race condition (overlaps C1)
- M2: XSS bypass vectors in reader HTML sanitizer
- M3: %/_ unescaped in search ilike — leaks full curator list
- M4: Slug generation TOCTOU race
- M5: N+1 RSS fetches on every feed page load
- M6: Server component live-fetches RSS on every render
- M7: Unauthenticated access to unpublished collections
- M8: Empty catch blocks swallowing RSS errors
- M9: published field accepted without boolean validation

### Low
- L1: Duplicate event listener leak in feed page
- L2: Vote counts initialized from user-controlled URL params
- L3: new URL() on localStorage data without try/catch
- L4: any typing + null feed_url crash in export
- L5: Sequential awaits for each imported source (N+1 DB)
- L6: setAll cookie error silently discarded
- L7: Misleading ownership assertion in sources route
- L8: followed curator IDs from client query params (no server validation)

## 2026-07-15 — Security fixes applied (Claude Sonnet)

Commits: 19d97c5, d0f86b5, (migration 008)

### Fixed
- ✅ C1-C4: All criticals resolved (vote inflation → RPC, RLS tightened, SSRF blocked via url-validator)
- ✅ H1-H5: All highs resolved (follower race → atomic RPC, open redirect fixed, signout URL fixed, import 1MB/500-feed caps, @ts-nocheck removed)
- ✅ Migration 008: follower + vote Postgres functions

### Remaining
- M1: Vote count race (verified — C1 RPC fix covers this)
- M8b: Empty catch in collections/[slug]/page.tsx (OpenCode only fixed rss/route.ts)

## 2026-07-15 — Medium/Low fixes applied (Claude Sonnet + OpenCode Go)

| Agent | Scope | Commit |
|---|---|---|
| Claude Sonnet | M5+M6: Background RSS refresh + ISR | a8f163e |
| OpenCode Go | M2-M4, M7-M9, L1-L8: 13 fixes | 1c386173 |

Total: 26/26 audit issues resolved. Build passes clean.

## 2026-07-18 — Discovery Pipeline Design Decisions (Hermes session)

Agent: Hermes (deepseek-v4-pro)
Scope: Research & decisions — no code written
KB: [[Internet Curators - RSS Discovery Index]] updated with full decisions

### Decisions locked
- Rejection filters: 4 layers (technical → quality → values → soft signals)
- Categories (generic: gaming, music, design) vs Tags (taste: indie, progressive, mainstream)
- Seed audit: all 216 sources through filter, survivors → pending, rejections removed
- Seed-user + all collections deleted. Max starts fresh with own curator
- Pipeline: weekly, 50/week cap, 10% Spanish, multiple specialized cron jobs
- OPML import: stays instant for users, also feeds discovery pipeline as signal
- Fediverse discovery + filter learning: deferred

### Source health audit
- 241 feeds checked (216 sources + 25 discovered)
- 174 OK (72%), 67 dead (28%)
  - 42 HTTP errors (mostly 404), 20 not-RSS (JS sites), 3 DNS failures, 1 timeout
- Validates filter-first approach — dead feeds never reach review queue

## 2026-07-20 — Discovery Pipeline Phase 2 (Hermes session)

Agent: Hermes (deepseek-v4-pro)
PR: #58 merged to main, deployed
Plan: `.hermes/plans/2026-07-20-discovery-pipeline-phase2.md` (Claude-reviewed)
Issues: #49–#57

### Built
- Migration 011: categories + tags tables, service_role RLS policies for cron jobs
- Migration 012: system curator "Editorial Board", `curators.user_id` made nullable
- Collection name fix: "Editor's Picks" (replaces placeholder product name)
- L0 feed health validator skill (`ic-feed-health`): curl-based RSS validation
- 3 weekly cron jobs (Telegram delivery):
  - Sat 9am: Directory Crawling (blogroll.org + ooh.directory)
  - Sun 9am: Platform Sitemaps (Bear Blog + Micro.blog)
  - Mon 9am: Web Search Combos (site: searches + keyword combos)
- Forgot-password flow: /forgot-password → /reset-password
- Each cron job: L0 health → skip guard → L1 quality → L2 blocklist → L3 signals → category/tags → INSERT pending
- Cap: 25/job, 10% Spanish, intra-run dedup, resume guard

### Seed audit
- 216 sources filtered: 131 passed → discovered_sources pending, 72 rejected, 8 skipped, 5 errors
- "Internet Curators Seed" curator + 21 collections deleted
- Final DB: 156 discovered_sources, 73 rejected_sources, 1 curator (maximogomez, editor)

### Deferred
- Mastodon/Lemmy, GitHub, Reddit/HN, blogroll crawling, filter learning, blocklist as public resource

## 2026-07-21 — Taxonomy Foundation (Hermes + OpenCode + Claude)

PR: #79 merged to main
Plan: `.hermes/plans/2026-07-21_taxonomy-foundation.md` (Claude-reviewed, 2 rounds)
Issues: #67–#78

### Built
- Migration 014: unified `tags` table (69 tags) with `facet` column (topic/voice/stance/format/language), `parent_id` for topic tree, keyword arrays for auto-tagging
- `source_tags` + `article_tags` junction tables with RLS policies
- Inherited tags resolve at query time (JOIN through source_tags); keyword-matched tags materialized at article insert
- `/api/tags` — public, grouped by facet
- `/api/sources/[id]/tags` — editor GET/PUT with bounds checking
- `/api/feed?tags=` — AND filtering with parent-to-child expansion
- `feed-refresher.ts` — keyword matching against article title+snippet for topic + voice facets
- SourceReviewCard tag assignment UI (topic grouped by parent, stance/format flat)
- PATCH approve endpoint accepts `tag_ids` for persistence on source creation
- ArticleCard tag chips (topic solid bg, voice border style, links to filtered feed)
- `/api/admin/article-tags` — editor keyword observability endpoint
- Reset all approved sources to pending so all go through new taxonomy flow

### Design decisions
- Faceted tags: Topic (tree, 2 levels) + Voice (article-level, keyword-matched) + Stance/Format/Language (source-level, editor-assigned)
- Voice is article-level because it describes writing style, not source identity
- "Academic" renamed "Scholarly" in Voice to avoid collision with Stance:Academic
- Climate & Energy moved from Science & Tech to Politics & Society (progressive editorial worldview)
- Social Science moved to History & Ideas
- Internet Culture under Arts & Culture (reader-facing nav, not political classification)
- Tags-at-query-time architecture: editorial corrections propagate to all articles immediately

### Agent attribution
- orchestration: hermes (deepseek-v4-pro) — research, plan draft, coordination
- review: claude (sonnet) — 2 rounds: conceptual/ethos + implementation/edge cases
- code: opencode (deepseek-v4-pro) — all TypeScript + SQL implementation
