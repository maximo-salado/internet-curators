"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Keyboard } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import type { Page } from "@/lib/compose-pages";
import {
  CaretLeft,
  CaretRight,
  List,
  ArrowsIn,
  ArrowsOut,
} from "@phosphor-icons/react";
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

  // -- fullscreen state --
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // -- Swiper instance ref --
  const swiperRef = useRef<SwiperType>(null);

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
    <div className="relative">
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
          <SwiperSlide key={i}>{renderPage(page)}</SwiperSlide>
        ))}
      </Swiper>

      {/* Gradient overlays */}
      <div className="pointer-events-none fixed top-0 inset-x-0 z-30 h-20 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="pointer-events-none fixed bottom-0 inset-x-0 z-30 h-20 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4">
        <button
          onClick={() => setNavOpen(true)}
          className="text-zinc-300 hover:text-white transition-colors"
          aria-label="Open navigation"
        >
          <List size={20} />
        </button>
        <button
          onClick={() => setTocOpen(true)}
          className="flex items-center gap-1 text-sm text-zinc-300 hover:text-white transition-colors"
          aria-label="Open table of contents"
        >
          <span className="font-semibold">RSSMag</span>
          <span className="text-zinc-400">#{issueNumber}</span>
        </button>
        <button
          onClick={toggleFullscreen}
          className="text-zinc-300 hover:text-white transition-colors"
          aria-label="Toggle fullscreen"
        >
          {isFullscreen ? <ArrowsIn size={18} /> : <ArrowsOut size={18} />}
        </button>
      </header>

      {/* Footer */}
      <footer className="fixed bottom-0 inset-x-0 z-40 h-14 flex items-center justify-between px-6">
        <button
          onClick={() => swiperRef.current?.slidePrev()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
          aria-label="Previous page"
        >
          <CaretLeft size={22} />
        </button>
        <span className="text-xs text-zinc-500 tabular-nums">
          {selectedIndex + 1} of {pages.length}
        </span>
        <button
          onClick={() => swiperRef.current?.slideNext()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
          aria-label="Next page"
        >
          <CaretRight size={22} />
        </button>
      </footer>

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
