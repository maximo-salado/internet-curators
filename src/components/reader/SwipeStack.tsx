"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Keyboard, EffectCreative } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import type { Page } from "@/lib/compose-pages";
import {
  CaretLeft,
  CaretRight,
  SquaresFour,
  DotsThree,
} from "@phosphor-icons/react";
import BookCoverClose from "@/components/reader/BookCoverClose";
import CoverPage from "@/components/reader/CoverPage";
import { ContextPage } from "@/components/reader/ContextPage";
import { ArticlePage } from "@/components/reader/ArticlePage";
import { SectionPage } from "@/components/reader/SectionPage";
import EditorPage from "@/components/reader/EditorPage";
import ClosingPage from "@/components/reader/ClosingPage";
import TocDrawer from "@/components/reader/TocDrawer";
import NavDrawer from "@/components/reader/NavDrawer";
import "swiper/css";
import "swiper/css/effect-creative";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SwipeStackProps {
  pages: Page[];
  startIndex?: number;
  onIndexChange?: (index: number) => void;
  issueNumber: number;
  issueDate: string;
  bottomOffset?: boolean; // shift footer + gradient up for BottomBar
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
  bottomOffset = false,
}: SwipeStackProps) {
  const router = useRouter();
  // -- local state --
  const [selectedIndex, setSelectedIndex] = useState(startIndex);
  const [tocOpen, setTocOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  // Cover art for the close animation (page 0 is always the cover)
  const coverPage = pages.find((p) => p.type === "cover");
  const coverImage = coverPage?.type === "cover" ? coverPage.coverImage : undefined;

  // -- sync URL on slide change --
  useEffect(() => {
    const url = `/issue/${issueNumber}?page=${selectedIndex + 1}`;
    window.history.replaceState(null, "", url);
  }, [selectedIndex, issueNumber]);

  // -- Swiper instance ref --
  const swiperRef = useRef<SwiperType>(null);

  // -- render a single page --
  const renderPage = (page: Page) => {
    switch (page.type) {
      case "cover":
        return <CoverPage coverImage={page.coverImage} />;
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
        modules={[Navigation, Keyboard, EffectCreative]}
        direction="horizontal"
        effect="creative"
        creativeEffect={{
          // Page-turn feel: the outgoing page hinges away on its left (spine)
          // edge in 3D while the next page slides up from beneath/right.
          perspective: true,
          limitProgress: 1,
          prev: {
            shadow: true,
            origin: "left center",
            translate: ["-12%", 0, 0],
            rotate: [0, -82, 0],
          },
          next: {
            translate: ["100%", 0, 0],
          },
        }}
        initialSlide={startIndex}
        onSlideChange={(swiper) => {
          setSelectedIndex(swiper.activeIndex);
          onIndexChange?.(swiper.activeIndex);

          if (
            swiper.activeIndex === pages.length - 1 &&
            pages[pages.length - 1]?.type === "closing"
          ) {
            try {
              localStorage.setItem(
                `rssmag-completed-${issueNumber}`,
                "true"
              );
            } catch {
            }
          }
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
          <SwiperSlide
            key={i}
            className="bg-black"
            style={{ boxShadow: "inset 0 0 0 1px rgba(161,161,170,0.28)" }}
          >
            {renderPage(page)}
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Gradient overlays */}
      <div className="pointer-events-none fixed top-0 inset-x-0 z-30 h-20 bg-gradient-to-b from-black/90 to-transparent" />
      <div className={`pointer-events-none fixed inset-x-0 z-30 h-20 bg-gradient-to-t from-black/90 to-transparent ${bottomOffset ? "bottom-12" : "bottom-0"}`} />

      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4">
        <button
          onClick={() => {
            if (closing) return;
            sessionStorage.setItem("mag-close-from", String(issueNumber));
            router.prefetch("/issues");
            setClosing(true);
          }}
          className="flex h-10 w-10 items-center justify-center text-zinc-300 hover:text-white transition-colors"
          aria-label="Back to shelf"
        >
          <SquaresFour size={20} />
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
          onClick={() => setNavOpen(true)}
          className="text-zinc-300 hover:text-white transition-colors"
          aria-label="Open navigation"
        >
          <DotsThree size={20} />
        </button>
      </header>

      {/* Footer */}
            <footer className={`fixed inset-x-0 z-40 flex items-center justify-between px-6 h-14 ${bottomOffset ? "bottom-12" : "bottom-0"}`}>
        <button
          onClick={() => swiperRef.current?.slidePrev()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
          aria-label="Previous page"
        >
          <CaretLeft size={22} />
        </button>
        <span className="text-xs text-zinc-400 tabular-nums">
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

      {/* Book-close animation → shelf (mirror of the open) */}
      {closing &&
        typeof document !== "undefined" &&
        createPortal(
          <BookCoverClose
            coverImage={coverImage}
            issueNumber={issueNumber}
            onComplete={() => router.push("/issues")}
          />,
          document.body,
        )}
    </div>
  );
}
