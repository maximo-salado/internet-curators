# Swipe Reader Pivot

> product vision pivot — July 27, 2026

## What Changes

**From:** a feed-based discovery experience with voting, saving, filters, accounts, and load-more pagination. Cards in a vertical list. A product with features.

**To:** a one-article-at-a-time swipeable reading stack. One card per screen. No features, no chrome, no accounts. Just reading, turned by gestures.

The dossier concept (saves → compile → share) is left intact for a future phase. This plan is Phase 1 only.

---

## North Star

> A woke tech magazine for the open web. Progressive voices, underrated writers, comics, weird indie sites — anything where critical thinking meets technology and how it touches everything. No hate, no discrimination, no algorithmic slop. Just one person's taste, served 20 articles at a time. Walk up, no account, no setup. One article per page. Turn pages by swiping. Leave when you're done.

**What it competes with:** the feed. Every reading app is a feed — Flipboard, Apple News, Feedly, even RSS readers. They all show you 20 headlines and ask you to choose. The abundance IS the obstacle.

**What it replaces with:** one thing at a time. No choice paralysis. No skimming. Either you read or you move on. The only UI is the article and the gesture.

**What it borrows:** the swipe interaction from Shorts/TikTok/Stories, but applied to reading instead of video. The section metaphor from physical newspapers — you can "turn to the sports section" without configuring preferences. The magazine cover/back-cover structure for a designed beginning and end.

---

## The Pile

The entire product is a horizontal swipe stack. Every "page" is a card. No separate screens, no navigation, no tabs. Just pages you turn.

### Page Types

**1. Cover** — first thing anyone sees. Mag name, one line about what this is, an arrow or subtle hint to swipe. It's page 1, not a landing screen you leave behind.

**2. Context page** — early in the stack. Not "pick your interests" (zero configuration, zero user preference). Instead: "A woke tech magazine. Progressive voices, underrated writers, critical thinking about technology and how it touches everything. No algorithms, no hate — just one person's taste." Sets the editorial stance and expectations. One or two of these before articles begin.

**3. Article** — the core page. One article, full screen.
- Title (large)
- Featured image (full width, if available)
- Opening text / snippet
- Source name, linked
- Scroll down to read more if content runs long
- Swipe left → next article. Swipe right → previous.
- No action buttons on the card itself

**4. Section page** — appears naturally in the stack as a "divider."
- Lists a few topics (Technology, Culture, Music, Design, etc.)
- Tap one → the stack filters to articles in that topic
- After reading a few articles in a section, another section page appears suggesting different topics
- No preferences saved. No configuration. Just: "where do you want to go next?" Like turning to a section in a physical paper.

**5. Editor page** — interspersed like section pages. A face, a name, a short note establishing the editorial voice. "This is a woke tech magazine. Progressive voices, underrated writers, comics, weird indie sites. No hate, no discrimination — just critical thinking about technology and how it touches everything." Human context for why this exists. If more editors join over time, their pages appear too.

**6. Closing page** — the back cover. The editor closes the experience.
- A note from the editor reinforcing the editorial stance
- "Get in touch" link
- "Help build this on GitHub" link
- A designed ending that says: you're done. Come back later.

**7. Ending page** — after 20 articles, a gentle stop. "You've read 20 articles. Come back tomorrow." Like closing a magazine. Not a punishment — a completion.

---

## What It Doesn't Have

- No login wall (no accounts at all in Phase 1)
- No save/bookmark (comes later, when dossiers return)
- No voting, no engagement signals
- No topbar, bottom nav, filters, settings
- No unread counts or notifications
- No algorithm or personalization
- No infinite scroll — the stack has a finite end
- No "pick your interests" onboarding
- No user preferences, no config

---

## Phase 1 Scope

**Max as sole editor.** One person curates the source pool. Friends are invited one at a time, slowly.

**No reader accounts.** The experience is fully anonymous. Nothing to sign up for. Nothing gated.

**No dossiers.** The save → compile → share loop returns in a future phase. Phase 1 is purely the reading experience.

**Sources:** the existing approved source pool and ingestion pipeline stay. No changes needed to the backend except possibly a simplified feed API.

---

## The Reading Loop

```
Cover → Context → Article → Article → Section → Article → Article → Editor → Article →
Article → Section → Article → Closing/Ending
```

Every session is a fresh shuffle of articles from the source pool (with the existing seed-based session shuffle). Section pages appear periodically. Editor pages appear occasionally. The closing page is always last.

---

## Anti-Fast-Swipe Guard

Since there's no video to auto-play and hook attention, fast-swiping past articles is possible. The guard isn't technical — it's the section page: if someone is swiping fast through articles without reading, they'll hit a section page that asks "where do you want to go?" That pause is the intervention. It breaks the swipe momentum and asks a question that requires engagement.

---

## Key Design Principles

1. **One thing at a time.** One article per screen. No decision fatigue.
2. **No chrome.** The article IS the UI. No persistent bars, buttons, or navigation.
3. **Human taste, not algorithms.** The pool is one person's (or a few people's) curation. The reader experiences someone's taste, not a ranking.
4. **Finite.** The stack has an end. Reading has a natural conclusion.
5. **Zero friction to start.** No accounts, no setup, no onboarding wizard. Just content.
6. **Gestures, not buttons.** Swipe to navigate. The only buttons are section taps and the closing page links.

---

## What Stays From The Current Build

- Supabase backend
- RSS ingestion pipeline
- Source pool with editor approval
- Tag system (topic/voice facets feed section pages)
- Seed-based session shuffle for article ordering
- Article content sanitization

## What Gets Removed (Phase 1)

- Vote up/down API and UI
- Save/bookmark API and UI
- Dismiss/hide API and UI
- Auth system (login, accounts, useAuth hook)
- BottomNav component
- FiltersBar component (replaced by section pages)
- DiscoverFeed vertical list layout
- ArticleCard component (replaced by full-screen swipe card)
- TopSources component
- Load More pagination
- The hero/landing section on homepage
- /article/[id] route (reading happens inline in the swipe stack)

---

## Decisions

- **Scroll + swipe:** swipe up/down scrolls article content. Swipe left/right navigates between articles. This will be tricky to get right — the touch conflict between vertical scroll and horizontal swipe needs careful handling.
- **Section pages:** appear every 5 articles. Predictable rhythm. After navigating to a section, the section-page cadence resets within that filtered stack.
- **Ending:** hard ending after 20 articles. A designed "you've read enough" page. Not a punishment — a completion.
- **Position indicator:** a simple page count (e.g. "3 of 20"), not a progress bar. Progress bars are too easily confused with website reading-progress indicators.
