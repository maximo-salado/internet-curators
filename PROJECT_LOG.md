# Internet Curators — Project Log

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
