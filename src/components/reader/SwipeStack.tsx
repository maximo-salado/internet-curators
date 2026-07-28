"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { EmblaCarouselType } from "embla-carousel";
import type { Page } from "@/lib/compose-pages";
import { CaretLeft, CaretRight, CaretDown, List } from "@phosphor-icons/react";
import CoverPage from "@/components/reader/CoverPage";
import { ContextPage } from "@/components/reader/ContextPage";
import { ArticlePage } from "@/components/reader/ArticlePage";
import { SectionPage } from "@/components/reader/SectionPage";
import EditorPage from "@/components/reader/EditorPage";
import ClosingPage from "@/components/reader/ClosingPage";
import TocDrawer from "@/components/reader/TocDrawer";
import NavDrawer from "@/components/reader/NavDrawer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SwipeStackProps {
  pages: Page[];
  startIndex?: number;
  onIndexChange?: (index: number) => void;
  issueNumber: number;
  issueDate: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract clientX / clientY from a TouchEvent or MouseEvent.
 * Returns null when touches are empty (e.g. touchcancel).
 */
function getEventCoords(
  evt: TouchEvent | MouseEvent,
): { x: number; y: number } | null {
  if ("touches" in evt) {
    return evt.touches.length > 0
      ? { x: evt.touches[0].clientX, y: evt.touches[0].clientY }
      : null;
  }
  return { x: evt.clientX, y: evt.clientY };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SwipeStack({
  pages,
  startIndex = 0,
  onIndexChange,
  issueNumber,
  issueDate,
}: SwipeStackProps) {
  // -- local state --
  const [selectedIndex, setSelectedIndex] = useState(startIndex);
  const [tocOpen, setTocOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);

  // -- hover zone for desktop navigation arrows --
  const [hoverZone, setHoverZone] = useState<"prev" | "next" | null>(null);

  // -- gesture strategy: Embla takes horizontal, browser takes vertical --
  const watchDrag = useCallback(
    (_emblaApi: EmblaCarouselType, evt: TouchEvent | MouseEvent) => {
      const coords = getEventCoords(evt);
      if (!coords) return; // can't decide — let Embla proceed

      if (
        evt.type === "pointerdown" ||
        evt.type === "touchstart" ||
        evt.type === "mousedown"
      ) {
        pointerOrigin.current = coords;
        return; // allow Embla to begin tracking
      }

      // pointermove / touchmove — decide based on angle
      if (pointerOrigin.current) {
        const dx = coords.x - pointerOrigin.current.x;
        const dy = coords.y - pointerOrigin.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Too small movement — don't override Embla's default
        if (dist < 4) return;

        // Angle from horizontal (0 = horizontal, 90 = vertical)
        const angle = Math.abs(Math.atan2(dy, dx)) * (180 / Math.PI);

        // Vertical gesture (angle > 30°) → let browser scroll native content
        if (angle > 30) return false;
      }
    },
    [],
  );

  // -- mouse hover zone tracking --
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const x = e.clientX;
    const third = window.innerWidth / 3;
    if (x < third) {
      setHoverZone("prev");
    } else if (x > third * 2) {
      setHoverZone("next");
    } else {
      setHoverZone(null);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverZone(null);
  }, []);

  // -- Embla --
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      axis: "x",
      startIndex,
      watchDrag,
    },
    [],
  );

  // -- navigation arrow click handlers --
  const handlePrevClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      emblaApi?.scrollPrev();
    },
    [emblaApi],
  );

  const handleNextClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      emblaApi?.scrollNext();
    },
    [emblaApi],
  );

  // -- sync selectedIndex with Embla snap --
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect(); // capture initial snap
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  // -- emit onIndexChange --
  useEffect(() => {
    onIndexChange?.(selectedIndex);
  }, [selectedIndex, onIndexChange]);

  // -- reset pointerOrigin on gesture end --
  useEffect(() => {
    if (!emblaApi) return;
    const root = emblaApi.rootNode();
    const reset = () => {
      pointerOrigin.current = null;
    };
    root.addEventListener("pointerup", reset);
    root.addEventListener("touchend", reset);
    root.addEventListener("touchcancel", reset);
    return () => {
      root.removeEventListener("pointerup", reset);
      root.removeEventListener("touchend", reset);
      root.removeEventListener("touchcancel", reset);
    };
  }, [emblaApi]);

  // -- render a single page --
  const renderPage = (page: Page) => {
    switch (page.type) {
      case "cover":
        return <CoverPage />;
      case "context":
        return <ContextPage />;
      case "article":
        return <ArticlePage item={page.item} />;
      case "section":
        return <SectionPage topics={page.topics} />;
      case "editor":
        return <EditorPage />;
      case "closing":
        return <ClosingPage count={page.count} />;
    }
  };

  // -- layout ---------------------------------------------------------------
  return (
    <div
      className="relative"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Embla viewport */}
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {pages.map((page, i) => (
            <div
              key={i}
              className="h-[100dvh] w-full flex-[0_0_100%] min-w-0"
            >
              {renderPage(page)}
            </div>
          ))}
        </div>
      </div>

      {/* Desktop hover-zone navigation arrows */}

      {/* Left hamburger button — opens NavDrawer */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setNavOpen(true);
        }}
        className="fixed top-4 left-4 z-20 text-zinc-500 hover:text-zinc-300 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Open navigation"
      >
        <List size={20} weight="bold" />
      </button>

      {/* Centered header label — tap to open ToC drawer */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setTocOpen(true);
        }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-200 transition-colors"
        aria-label="Open table of contents"
      >
        <span className="font-semibold text-zinc-300">RSSMag</span>
        <span className="text-zinc-600">#{issueNumber}</span>
        <CaretDown size={14} weight="bold" />
      </button>

      {/* Desktop hover-zone navigation arrows (prev/next) */}
      <button
        type="button"
        onClick={handlePrevClick}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-300 ring-1 ring-zinc-700/50 backdrop-blur-sm transition-all duration-200 hover:text-white"
        style={{ opacity: hoverZone === "prev" ? 0.9 : 0 }}
        aria-label="Previous page"
      >
        <CaretLeft size={24} weight="bold" />
      </button>
      <button
        type="button"
        onClick={handleNextClick}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-300 ring-1 ring-zinc-700/50 backdrop-blur-sm transition-all duration-200 hover:text-white"
        style={{ opacity: hoverZone === "next" ? 0.9 : 0 }}
        aria-label="Next page"
      >
        <CaretRight size={24} weight="bold" />
      </button>

      {/* Position indicator — subtle, top-right */}
      {pages.length > 0 && (
        <div className="pointer-events-none fixed right-4 top-4 z-50 select-none rounded-full bg-black/50 px-3 py-1 font-mono text-xs text-white/80 backdrop-blur">
          {selectedIndex + 1} of {pages.length}
        </div>
      )}

      {/* ToC drawer */}
      <TocDrawer
        pages={pages}
        issueNumber={issueNumber}
        issueDate={issueDate}
        currentIndex={selectedIndex}
        onNavigate={(index) => {
          emblaApi?.scrollTo(index);
          setTocOpen(false);
        }}
        open={tocOpen}
        onClose={() => setTocOpen(false)}
      />
      {/* Nav drawer */}
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}
