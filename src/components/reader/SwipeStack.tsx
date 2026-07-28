"use client";

import { useState, useCallback, useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Keyboard } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
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
import "swiper/css";

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

  // -- Swiper instance ref --
  const swiperRef = useRef<SwiperType>(null);

  // -- hover zone for desktop navigation arrows --
  const [hoverZone, setHoverZone] = useState<"prev" | "next" | null>(null);

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

  // -- navigation arrow click handlers --
  const handlePrevClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    swiperRef.current?.slidePrev();
  }, []);

  const handleNextClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    swiperRef.current?.slideNext();
  }, []);

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
      {/* Swiper carousel */}
      <Swiper
        modules={[Navigation, Keyboard]}
        direction="horizontal"
        initialSlide={startIndex}
        onSlideChange={(swiper) => {
          setSelectedIndex(swiper.activeIndex);
          onIndexChange?.(swiper.activeIndex);
        }}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
        }}
        nested
        resistanceRatio={0}
        speed={300}
        spaceBetween={0}
        slidesPerView={1}
        keyboard={{ enabled: true }}
        style={{ height: "100dvh", width: "100%" }}
      >
        {pages.map((page, i) => (
          <SwiperSlide key={i}>
            {renderPage(page)}
          </SwiperSlide>
        ))}
      </Swiper>

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
          swiperRef.current?.slideTo(index);
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
