# Feed Ranking & Source Reputation
**Date:** 2026-07-25
**Status:** Deprecated — superseded by swipe-reader pivot (July 27, 2026)

---

## What

Two independent ranking systems. One invisible (article feed order). One visible (source discovery tab). Source reputation is earned downstream from article engagement, not from age or follower count. No gatekeeping.

## Authentication & Canonical Data

All votes and actions require authentication. `user_article_actions` is the canonical table for all per-user signals. `article_votes` is legacy and must not be extended.

## Logged-Out Experience

Logged-out users see a reverse-chronological feed. No personalization, no scoring, no action buttons. Personalized ranking activates on sign-in.

---

## Article Ranking (feed order — invisible)

Per-user, logged-in only. Never shown to the user.

### Signals

| Signal | Weight | Meaning | Infra status |
|---|---|---|---|
| Dismiss | Hard filter | Remove this article from this user's feed forever | ⚠ Needs server-side persistence |
| Source hide | Hard filter | Remove all articles from this source from this user's feed | ⚠ Needs server-side persistence |
| Save | Strong positive | "This mattered to me" | Existing |
| Upvote | Positive | "More like this" | Existing (`user_article_actions`) |
| Open (read) | Weak positive | "Caught my eye" — only meaningful at scale | ⚠ Read tracking not yet implemented |
| Downvote | Weak negative | "Less like this" — softer than dismiss | Existing (`user_article_actions`) |
| Source follow | Boost | Lift articles from followed sources (see below) | Existing |

No ranking signal depends on topic or content similarity. That work is deferred.

### Freshness Decay

```
freshness = max(0.25, 2^(−hours_since_publish / 48))
```

| Age | Factor |
|---|---|
| 0h | 1.0 |
| 48h | 0.5 |
| ~96h | 0.25 (floor reached) |
| 1 week+ | 0.25 (floor) |

Articles never rank at zero due to age.

### Follow Boost

Followed sources get a 2x lift that decays linearly over 7 days since the source's last article. A followed source that stops posting fades back to baseline.

```
boost = 1 + max(0, 1 − days_since_last_article / 7)
```

| Days since last article | Boost |
|---|---|
| 0 | 2× |
| 3.5 | 1.5× |
| 7+ | 1× (baseline) |

Dismissed articles and hidden sources are filtered before scoring.

---

## Article Action Counts (visible — on every card)

Raw human signals displayed as plain numbers. No derived score. Adds accountability without algorithmic feel.

| Button | Shows | Infra status |
|---|---|---|
| ↑ Upvote | 47 | Existing |
| ↓ Downvote | 12 | Existing |
| Save | 24 saved | ⚠ Needs denormalized aggregate counter |
| Dismiss | 8 passed | ⚠ Aggregate pass counter not yet tracked |

---

## Source Reputation (visible — discovery and source lists only)

Computed from aggregate article engagement. Never affects article feed ranking.

### Normalization — Bayesian Average

A source's reputation score is the Bayesian average of saves per article:

```
score = (total_saves + C × μ) / (article_count + C)
```

- `μ` — global mean saves per article across all sources
- `C` — confidence constant (e.g. 10, equivalent to ten average articles)

This shrinks estimates toward the prior for sources with few articles, preventing a single high-save article from inflating an otherwise untested source — while still rewarding genuine breakout sources over established ones with mediocre engagement.

### Rising Badge

Awarded when a source has **≥ 3 articles** and **≥ 5 saves in the last 7 days**. Recalculated daily.

### Display

On the source card or profile:
- "Articles from this source have been saved 340 times across 12 articles"
- **Rising** badge when criteria above are met

### Cold-Start Discovery Lane

A dedicated **New Sources** lane in source discovery surfaces sources that have published fewer than 3 articles and have not yet accumulated enough data to rank naturally. This lane is separate from the reputation-ranked list and ensures new sources are reachable before they've earned a score. Ordering and curation rules for this lane are TBD in the source discovery tab plan.

### Source Actions (source detail page)

| Action | Effect |
|---|---|
| Follow | Apply follow boost to all articles in personal feed. Add to profile. |
| Unfollow | Remove boost. Source stays in feed at baseline. |
| Hide | Remove this source from personal feed entirely. ⚠ Needs server-side persistence |
| Share | Copy link to source profile. |

Counts visible on source page: followers, total saves across articles.

---

## Infrastructure Required

| Feature | What's needed |
|---|---|
| Read/open tracking | New event write path; no signal is captured today |
| Aggregate save counter per article | Denormalized counter or materialized view; currently requires a full per-user join |
| Aggregate pass/dismiss counter per article | Same; dismiss count is not stored in aggregate at all |
| Server-side hide and dismiss | Per-user scoped rows; currently not persisted server-side |

---

## What Does Not Happen

- No global ranking of articles ("most popular today")
- No source score that gates articles from appearing in the feed
- No trending or algorithmic feed
- No ranking based on topic or content similarity (deferred)
- A new source with zero followers gets equal shot in the feed
- Source reputation is informational only — for browsing, not gatekeeping

---

## Out of Scope

- Source discovery tab UI (separate plan)
- Topic-based personalization (deferred; requires content analysis infrastructure not yet in place)
- Collaborative filtering ("readers who saved this also saved…")
