"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";

type EmblaApi = NonNullable<ReturnType<typeof useEmblaCarousel>[1]>;

// ── long text to fill scrollable articles ──────────────────────────────
const LONG_TEXT = Array.from({ length: 12 }, (_, i) => {
  const paras = [
    "The feed reader reimagined — swipe through articles like a story, one screen at a time. No endless scrolling, no tab overload. Just you and the words that matter.",
    "RSS has been around for over two decades, quietly powering the open web. It doesn't track you, doesn't optimize for outrage, and doesn't care about your watch history.",
    "In a world of algorithmic feeds, RSS is a deliberate choice. You pick the sources. You control the order. You decide when you're done reading — not some slot-machine UI designer in California.",
    "The challenge has always been the reader experience. Traditional RSS readers look like email clients from 2003. That's fine for power users, but it's never going to bring RSS to everyone else.",
    "What if reading feeds felt like flipping through a magazine? Each article gets a full screen. Swipe right to move on. Swipe left to go back. Scroll down to read more.",
    "Design matters. The difference between an app people use once and an app they use every day is often just how it makes them feel. Swiping should feel good.",
    "Performance is part of the experience. A janky swipe at 30fps ruins the illusion. The carousel needs to run at a buttery 60fps with instant response to touch — no perceptible latency.",
    "Accessibility is not optional. Arrow keys for keyboard users, proper focus management for screen readers, and reduced-motion support for people who need it.",
    "The offline story is compelling too. RSS feeds are just XML files. You can cache them, preload them, and serve them from a service worker. No internet? No problem.",
    "Privacy-first means no trackers, no analytics SDKs, no third-party scripts. The articles load directly from the source. The reader doesn't phone home.",
    "The long tail of the internet lives in RSS. Personal blogs, indie newsletters, academic journals, niche hobby sites — all the stuff that doesn't make it into an algorithm.",
    "Building a better feed reader is an act of digital gardening. It's slow work, deeply human, and quietly radical in an age of infinite scroll and infinite distraction.",
  ];
  return paras[i % paras.length];
})
  .map((p) => `<p class="text-zinc-300 leading-relaxed mb-4">${p}</p>`)
  .join("\n");

// ── card data ──────────────────────────────────────────────────────────
const CARDS = [
  {
    id: "cover",
    title: "RSSMag",
    subtitle: "Swipe Reader Spike",
    body: `<p class="text-zinc-400 text-lg leading-relaxed">Horizontal swipe between full-screen cards. Three long articles follow — scroll vertically inside each. Press ← → on desktop. Counter shows your position.</p>`,
  },
  {
    id: "article-1",
    title: "The Quiet Rebellion of RSS",
    subtitle: "Why open protocols still matter",
    body: LONG_TEXT,
  },
  {
    id: "article-2",
    title: "Designing for the Swipe",
    subtitle: "Touch, physics, and the feel of paper",
    body: LONG_TEXT,
  },
  {
    id: "article-3",
    title: "Privacy by Default",
    subtitle: "No trackers, no algorithms, no nonsense",
    body: LONG_TEXT,
  },
  {
    id: "closing",
    title: "That's the Spike ✓",
    subtitle: "Now go build the real thing",
    body: `<p class="text-zinc-400 text-lg leading-relaxed">Embla Carousel handles swipes, the nested scroll works, arrow keys navigate, and the counter tracks position. All baseline behavior confirmed.</p>`,
  },
];

// ── page ───────────────────────────────────────────────────────────────
export default function SpikePage() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: false,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [slideCount, setSlideCount] = useState(0);

  // track selection
  const onSelect = useCallback((api: EmblaApi) => {
    setSelectedIndex(api.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    setSlideCount(emblaApi.scrollSnapList().length);
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    onSelect(emblaApi);
  }, [emblaApi, onSelect]);

  // arrow key navigation
  useEffect(() => {
    if (!emblaApi) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        emblaApi.scrollPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        emblaApi.scrollNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [emblaApi]);

  return (
    <div className="relative h-[100dvh] w-full bg-black text-zinc-100 overflow-hidden">
      {/* page counter */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 text-xs font-mono text-zinc-400 bg-black/60 backdrop-blur rounded-full">
        {selectedIndex + 1} of {slideCount}
      </div>

      {/* carousel viewport */}
      <div ref={emblaRef} className="h-full w-full overflow-hidden">
        <div className="flex h-full touch-pan-y">
          {CARDS.map((card, i) => (
            <div
              key={card.id}
              className="flex-[0_0_100%] h-full flex flex-col"
            >
              {/* header (sticky, doesn't scroll) */}
              <div className="flex-shrink-0 px-6 pt-16 pb-4">
                <h1 className="text-2xl font-bold text-white">{card.title}</h1>
                <p className="text-sm text-zinc-500 mt-1">{card.subtitle}</p>
                <div className="mt-4 h-px w-full bg-zinc-800" />
              </div>

              {/* scrollable body */}
              <div
                className="flex-1 overflow-y-auto overscroll-contain px-6 pb-24"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: spike
                dangerouslySetInnerHTML={{ __html: card.body }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
