# Exploration Log — July 31, 2026

## The Vision Shift

We started in the wrong place. Cards. Carousels. A perfectly competent RSS reader with a grid of article previews, swipe gestures, the usual web furniture. It worked. It was also soul-deadening.

The internet doesn't need another flat website. It needs a place where reading feels like something you *chose* to do — not something that happened to you while you scrolled.

So we threw out the cards. All of them. No popups, no modals, no "click to read more" overlays. Instead, we asked: what if this felt like a physical magazine? Not a metaphor slapped on — the real thing. A shelf with issues you can browse. Covers you can pick up. Pages you can turn. Articles you can sink into.

The philosophy crystallized around **delightful friction**. Infinite scroll is a trap — it removes decisions so you never stop. What if we put decisions back? At every level, you must deliberately choose: which magazine from the shelf, which article to flip to, whether to commit to reading. Each level has a constrained swipe range. The constraint *is* the feature. Finite content, finite choices, intentional engagement.

## The Three Levels

The architecture fell into three distinct physical spaces, each with its own gesture language.

### Level 1 — The Shelf

This is where you land. Magazines arranged horizontally, each with a cover — issue number, article count, a lead image, a gradient wash, a date. The centered cover lifts with a subtle depth-of-field scaling effect, giving the shelf actual dimension. Covers have 3D tilt. Swipe left or right to browse issues. Pick one.

Instead of a time-navigation header, we landed on a calendar icon — a physical object you'd recognize, not a UI widget. The bookmark CTA lives as an action, not a persistent header decoration. These are small choices that compound: every element either belongs in the physical metaphor or gets cut.

### Level 2 — Browse (Opening the Magazine)

This is the magic moment. The cover zooms from its shelf position with a spring, then flips open — not from center like a playing card, but from the left edge, like a real cover rotating from the binding. `transformOrigin: "left center"`. Behind it: the article spread.

On phone + tablet portrait (breakpoint at 1024px, not 768px), you see one page at a time. On desktop/tablet landscape, you get a two-page spread with a spine. Content is scaled to 65–75% with a gradient fade at the bottom, signaling more below.

Swipe horizontally to flip through articles in preview. The gesture is finger-tracked — page follows your thumb in real time, snaps on release. This matters enormously: it's the difference between pushing something physical and triggering a discrete event.

### Level 3 — Reading (Scroll-Driven Zoom)

Here's where the levels dissolve into each other. There's no page load, no navigation event, no mode switch. Scroll down on an article preview and it *becomes* the reading view — the article grows continuously from 75% to 100% scale as you scroll, driven proportionally by your gesture. By the time you're at full scale, the article is scrollable and you're reading.

Scroll up at the top of an article and it zooms back out to L2. The blend is continuous: at zoom level 0, all delta goes to zoom. At zoom level 1, all delta goes to article scroll. In between, it's proportional. One gesture, one flow, no seams.

Snap on release: above 50% snaps to reading mode, below snaps back to browse. The 200ms debounce prevents jitter.

## Key Design Decisions

### No Web UI Language — Physical Metaphors Only

This was the hardest rule to hold and the most important. Every time we reached for a card, a popup, a modal, a "view more" button — we stopped and asked: what would this be in a physical magazine? Magazines on a shelf. Covers that open. Pages that turn. Grabbing, flipping, zooming, closing. Not clicking, selecting, dismissing.

The language you use shapes the thing you build. When you say "card" you reach for `box-shadow` and `border-radius`. When you say "magazine cover" you reach for gradients, depth of field, paper textures.

### Design-Token-First — Painfully Learned

We learned this the hard way. Hardcoded values scattered across components — `text-[10px]` here, `bg-zinc-800` there, `border-amber-600/50` everywhere. Refactoring meant hunting through dozens of files. Changing the amber accent meant find-and-replace across the entire codebase. Never again.

Every value — font sizes, colors, spacing, radii, shadows — lives in Tailwind v4's `@theme` block or CSS custom properties. Components reference tokens, never raw values. This isn't just hygiene; it's the difference between a design system and a pile of CSS.

### Font Scale

12px minimum — tertiary labels, fine print. 14px for secondary info. 16px for body text and CTAs. 18px for cover information. 24px for the logo. Nothing smaller. Accessibility as a floor, not a feature.

### The Color and Material Language

Amber borders against zinc-900 pages. Paper textures — subtle noise overlays, off-white warmth on the reading surface. The spine is a real thing on desktop spreads: a thin vertical amber line with adjacent shadows. Calendar icon for time navigation. Bookmark as a CTA action, not a persistent icon in a header bar.

### Device Behavior

Tablet portrait is phone UX. The breakpoint is 1024px, not 768px — we tried the conventional breakpoint and it's wrong for this shape. A tablet in portrait is held like a phone, single-hand. Landscape is a two-page spread, like an open magazine on a desk.

## Technical Explorations

### Cover Zoom + Flip Animation

Inspired by Paper by WeTransfer's fluid open/close gesture. The cover uses a two-phase animation: first zoom (spring from shelf position to fullscreen, backdrop dims behind), then flip (rotateY to -160° from left edge, revealing the spread). `onAnimationComplete` callbacks chain the phases cleanly. The cover wrapper gets `pointerEvents: "none"` after the flip — otherwise it blocks all interaction on the spread beneath.

The shelf dims via a backdrop fade during the zoom, creating depth and focus. When closing, the animation reverses and the cover settles back into the carousel.

### Page Turning — The Evolution

We went through three wrong approaches before finding the right one:

**Attempt 1: Card Flip.** `transformOrigin: "center center"`, rotateY 180°. Spins like a playing card. Looks like a cheesy PowerPoint transition. Wrong metaphor, wrong feel.

**Attempt 2: Edge-Pivot with Threshold.** Switched to `transformOrigin: "left center"` — correct, the page rotates from the binding edge. But we triggered on touchEnd with a 60px threshold. Feels dead. You swipe, nothing happens until you release, then it snaps. Like a switch, not like paper.

**Attempt 3: Finger-Tracked Continuous Rotation.** This is the one that worked. On touchMove, the horizontal drag (`dx`) continuously drives the rotateY angle: `-(dx / screenWidth) * 170`. The page follows your thumb. On touchEnd: >80px snaps to full turn and advances the spread index; ≤80px springs back to flat (cancel the turn). During drag, `duration: 0` — instantaneous tracking. During snap, a spring transition. `onAnimationComplete` fires the spread index change.

The edge strip — the turned-over page visible as a thin vertical slice on the left when you've advanced — is a static element at `rotateY: -170°`, opacity 0.35, fading in behind the current spread. It stays in DOM (not inside AnimatePresence, which removes old elements) as a direct sibling. This creates the illusion of accumulating pages in a stack.

### Scroll-Driven Zoom

The wheel handler was the first pass, but touch is where it came alive. wheel events fire many small deltas; a sensitivity of 0.001 works fine. Touch produces one large delta per gesture — we needed 0.004–0.005 to feel responsive (~300px swipe covers the full zoom range).

The blend is the key insight. You don't switch between "zoom mode" and "scroll mode" — you're always in both, proportionally. At zoom 0.3, 30% of your gesture scrolls the article and 70% zooms. At zoom 0.7, it's 70% scroll and 30% zoom. At zoom 1.0, it's pure scroll. The scroll-up-at-top escape hatch redirects full delta to zoom-out, preventing the trap where you can't leave reading mode.

Critical pitfall: `data-scroll-container` must live on the ArticlePage root (the actual scrollable div), not the scaled wrapper. The wrapper was shadowing the real container, and `querySelector` was finding the wrong element. Took embarrassingly long to debug.

### SVG Spine Shadows — The Curvature Illusion

CSS 3D can never do real page curvature. It's flat planes rotating in 3D space. No amount of `transform` chaining will bend a `<div>` along a cylinder.

But you can fake it with a gradient overlay near the spine during page turns. A narrow strip (24px) with a linear gradient from transparent through semi-transparent black back to transparent, positioned at the spine edge, with opacity peaking at mid-turn (where curvature would be strongest) via a sin function: `opacity = Math.sin(|dragRotation| / 170 * π)`. Zero at 0° and 170°, maximum at 85°. Pure CSS, no SVG needed despite the name. The brain fills in the rest.

### WebGL Research — The Real Curvature Frontier

CSS 3D: flat planes, always. WebGL + Canvas: real cylinder-bend geometry with fragment-level lighting and shadows. But there's a fundamental bottleneck.

The only way to get live DOM content into a WebGL texture is through `html2canvas` — a DOM-to-bitmap snapshot. This takes 200–800ms per complex page and consumes 20–40MB memory per page. During the animation, the content is a static image — no text selection, no scroll, no interaction. It's a visual effect, not a reading surface.

Libraries across the spectrum:

- **turngl** (new, MIT): Three.js + PDF.js, real curvature, but PDF-only. No live DOM.
- **webgl-page-curl**: html2canvas snapshot into a WebGL cylinder shader. Real curvature during animation, but the page is a frozen bitmap.
- **StPageFlip**: Canvas 2D, works with live DOM blocks. No curvature — flat-plane only. Unmaintained for 5 years.
- **DearFlip** (commercial): WebGL, PDF-based. The gold standard for real page curls. PDF-only.
- **turn.js**: jQuery, CSS flat flips, live DOM. Dead project.

The dream: `drawElementImage()` — a W3C API that renders live DOM directly as a Canvas/WebGL texture, no snapshot needed. It's Chrome-flag-only, years from production. When it lands, real page curls with live, interactive HTML become possible. Until then, the practical ceiling is CSS 3D flat-planes with SVG curvature overlays.

### CSS 3D vs WebGL vs Canvas vs SVG — The Tradeoff Matrix

| Approach | Live DOM | Curvature | Perf | Complexity | Production Ready |
|----------|----------|-----------|------|------------|------------------|
| CSS 3D + SVG overlays | ✓ | Fake (shadows) | Excellent | Low | ✓ |
| Canvas 2D (StPageFlip) | ✓ | None | Good | Medium | ✓ (unmaintained) |
| WebGL + html2canvas | ✗ (static snapshot) | ✓ Real | Moderate | High | ✓ |
| WebGL + drawElementImage | ✓ | ✓ Real | Unknown | Very High | ✗ (years away) |

### Lottie for Micro-Animations

We've explored Lottie for detail animations — subtle page flutters, spine shine, bookmark ribbon drops. The `lottie-react` package is in the project, but we haven't wired it in yet. The challenge is keeping Lottie animations aligned with the gesture system — a hardcoded animation timeline doesn't respond to finger drag. The approach would be: Lottie for ambient, non-interactive details; gesture-driven transforms for everything the user touches.

## What We Learned

### CSS 3D Has Hard Limits

No matter how creative you get with transforms, CSS 3D is flat planes in a 3D coordinate system. You can rotate them, translate them, perspective them — but you can't bend them. This is fine for the current design; the SVG overlay creates convincing enough curvature that users don't notice the flatness. But it's a ceiling we know is there.

### WebGL's Live-DOM Gap

The html2canvas bottleneck is real and painful. The library works, but it turns your living, interactive HTML into a frozen JPEG for the duration of the animation. That's not acceptable for a reading app where users might want to select text or interact with content mid-gesture. `drawElementImage()` is the solution but it's not here yet.

### Finger-Tracked > Threshold-Based

This was the biggest UX lesson. Every time we used touchEnd with a threshold (swipe > 60px → do something), it felt mechanical and dead. Every time we used touchMove with continuous tracking (the element follows your thumb in real time), it felt physical and alive. The difference isn't subtle — it's the difference between a UI and an object.

### Concurrent OpenCode Delegations Corrupt Turbopack Cache

Running multiple OpenCode subagents editing the same files concurrently causes race conditions, dropped variables, and conflicting edits. But the nasty one is caching: Turbopack's SST database gets corrupted when two processes write to `.next/dev/cache` simultaneously. Fix: `rm -rf .next/dev/cache`. Prevention: stagger delegations. Never run two OpenCode instances editing the same file tree at once.

### Design Tokens Are Not Optional

The cost of retrofitting tokens into a codebase with scattered hardcoded values is approximately 4x the cost of building token-first from the start. Every `text-[10px]` and `bg-zinc-800` becomes a migration task. Do it right the first time.

### Always Delegate Code to OpenCode

The workflow that works: plan in conversation, research and decide architecture, then hand the implementation to OpenCode with a detailed spec. The subagent writes cleaner, more consistent code than inline edits. It also prevents the pattern where conversational context leaks into implementation decisions — the spec becomes the contract.

## Open Questions

### WebGL Hybrid Approach

When `drawElementImage()` matures, a hybrid approach becomes viable: render the page as a live DOM texture, map it onto a WebGL cylinder, and maintain interactivity through the Canvas surface. This would give real page curvature with live text selection, links, and scrolling — the holy grail. Worth revisiting every 6 months as browser APIs evolve.

### Lottie Integration Strategy

Where does Lottie fit? Ambient details that don't respond to gestures: a subtle shimmer on the amber spine, a paper texture ripple on page turn completion, a ribbon animation on bookmark. These add craft without complicating the gesture system. The risk is over-animating — the magazine should feel paper-like, not Disney-like.

### Calendar Grid for Time Navigation

The calendar icon placeholder needs to become a real calendar grid — browsing issues by date, not just sequential swipe. This is the natural navigation complement to the shelf: a temporal map of the archive. The challenge is making it feel like a physical calendar (desk blotter, wall calendar, planner) rather than a date picker widget.

### Further Refinement

The scroll-blend could be smoother at the transition boundaries. The page-turn feel could have a subtle paper-rustle audio cue. The shelf depth-of-field effect could be more pronounced. The spine shadow could respond to ambient light angle. None of these are broken — they're just the next 5% that separates good from great.

---

*This log captures a day of design philosophy, not a changelog. The code will move fast. The principles — physical metaphor, delightful friction, gesture as language — should move slow.*
