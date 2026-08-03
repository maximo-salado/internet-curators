# Lottie Animation Candidates for RSSMag

All animations are free on LottieFiles (Lottie Simple License).

## Page Turn / Page Flip (Spine Shadow)
For `MagazineSpread.tsx` — spine shadow during page turn

| Animation | URL |
|-----------|-----|
| Turn Page (irwanto) | https://lottiefiles.com/free-animation/turn-page-BzG3naIDYq |
| Book Page Flip (Joshua Owen) | https://lottiefiles.com/free-animation/book-page-flip-Gi6ueWhraX |
| Book Page Opening (Weblodge) | https://lottiefiles.com/free-animation/book-page-opening-lottie-json-animation-NwCSz2mQhG |
| Browse all page-flip | https://lottiefiles.com/free-animations/page-flip |
| Browse all turn-page | https://lottiefiles.com/free-animations/turn-page |

**Recommendation:** Try "Book Page Opening" (Weblodge) or "Book Page Flip" (Joshua Owen) first — 
they're closest to the spine-shadow effect needed.

## Bookmark Animation
For `ShelfCarousel.tsx` — bookmark icon

| Animation | URL |
|-----------|-----|
| Bookmark (Bryan Trang) | https://lottiefiles.com/free-animation/bookmark-animation-4RvABixGEr |
| Bookmark (Yup Nguyen) | https://lottiefiles.com/free-animation/bookmark-1fUmhjExkj |
| Browse all bookmark | https://lottiefiles.com/free-animations/bookmark |

**Recommendation:** "Bookmark" by Yup Nguyen — clean toggle-style animation.

## Close / Dismiss Animation
For `Magazine.tsx` — close button

| Animation | URL |
|-----------|-----|
| Close Button (TheBSF) | https://lottiefiles.com/free-animation/close-button-s4fhdCDUcS |
| X Animation | https://lottiefiles.com/free-animation/x-animation-eorXbKRU0X |
| Browse all close | https://lottiefiles.com/free-animations/close |

**Recommendation:** "Close Button" by TheBSF — smooth morph from hamburger to X.

## Subtle Transition / Loading
For page transitions and loading states

| Animation | URL |
|-----------|-----|
| Browse all loading | https://lottiefiles.com/free-animations/loading |
| Browse page-loading | https://lottiefiles.com/free-animations/page-loading |
| Browse morph transitions | https://lottiefiles.com/free-animations/morph |

## How to Download
1. Open the LottieFiles URL in a browser
2. Click the "Download" button
3. Choose "Lottie JSON" format
4. Save to `public/lottie/` directory
5. Name files like: `page-turn.json`, `bookmark.json`, `close-button.json`, `loading.json`

## Integration Example
```tsx
import Lottie from 'lottie-react';
import closeAnim from '@/public/lottie/close-button.json';

<Lottie
  animationData={closeAnim}
  loop={false}
  style={{ width: 24, height: 24 }}
/>
```

## Fallback Animations
Two basic placeholder animations have been created in `public/lottie/`:
- `close-x.json` — simple X morph animation
- `bookmark.json` — simple bookmark pulse animation

These can be used until proper animations are downloaded.
