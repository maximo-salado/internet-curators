"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { FeedItem } from "@/lib/compose-pages";
import { ArticlePage } from "@/components/reader/ArticlePage";

interface IssueData {
  issue: { number: number; date: string; count: number; origin: string; isToday: boolean; published: boolean; leadImage?: string };
  items: FeedItem[];
}

interface MagazineSpreadProps {
  issueNumber: number;
  spreadIndex: number;
  onSpreadIndexChange: (index: number) => void;
  onTotalSpreadsChange: (totalSpreads: number, totalArticles: number) => void;
  onZoomChange: (zoomLevel: number, focusedArticleIndex: number | null) => void;
}

type Spread = { left: FeedItem; right: FeedItem | null };

export default function MagazineSpread({
  issueNumber,
  spreadIndex,
  onSpreadIndexChange,
  onTotalSpreadsChange,
  onZoomChange,
}: MagazineSpreadProps) {
  const [issueData, setIssueData] = useState<IssueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isMobile, setIsMobile] = useState(false);

  // ── Zoom state ────────────────────────────────────────────────
  const [zoomLevel, setZoomLevel] = useState(0);
  const [focusedArticleIndex, setFocusedArticleIndex] = useState<number | null>(null);
  const zoomRef = useRef(0);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/feed?issue=${issueNumber}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setIssueData({ issue: data.issue, items: data.items ?? [] });
      })
      .catch(() => {
        if (!cancelled) setIssueData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [issueNumber]);

  // ── Reset zoom when spread changes ───────────────────────────
  useEffect(() => {
    setZoomLevel(0);
    setFocusedArticleIndex(null);
    zoomRef.current = 0;
    if (snapTimerRef.current) {
      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
  }, [spreadIndex]);

  // ── Sync zoomRef with zoomLevel ──────────────────────────────
  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);

  // ── Report zoom changes up ───────────────────────────────────
  useEffect(() => {
    onZoomChange(zoomLevel, focusedArticleIndex);
  }, [zoomLevel, focusedArticleIndex, onZoomChange]);

  // ── Snap behavior ────────────────────────────────────────────
  const scheduleSnap = useCallback(() => {
    if (snapTimerRef.current) {
      clearTimeout(snapTimerRef.current);
    }
    snapTimerRef.current = setTimeout(() => {
      const current = zoomRef.current;
      if (current > 0.5 && current < 1) {
        zoomRef.current = 1;
        setZoomLevel(1);
      } else if (current > 0 && current <= 0.5) {
        zoomRef.current = 0;
        setZoomLevel(0);
        setFocusedArticleIndex(null);
      }
      snapTimerRef.current = null;
    }, 200);
  }, []);

  // ── Wheel-driven zoom (mobile only) ───────────────────────────
  useEffect(() => {
    if (!isMobile) return;
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Find which article page the mouse is over
      const target = e.target as HTMLElement;
      const articlePage = target.closest("[data-article-index]") as HTMLElement | null;
      if (!articlePage) return;

      const articleIndex = parseInt(articlePage.dataset.articleIndex || "", 10);
      if (isNaN(articleIndex)) return;

      const currentZoom = zoomRef.current;

      if (currentZoom < 0.85) {
        // ── ZOOM MODE: scroll controls zoom level ──
        e.preventDefault();

        // Sensitivity: deltaY positive = scroll down = zoom in
        const delta = e.deltaY * 0.001;
        const newZoom = Math.max(0, Math.min(1, currentZoom + delta));

        zoomRef.current = newZoom;
        setZoomLevel(newZoom);

        if (focusedArticleIndex === null || focusedArticleIndex !== articleIndex) {
          setFocusedArticleIndex(articleIndex);
        }

        scheduleSnap();
      } else {
        // ── READING MODE: scroll controls article content ──
        // Check if the article's scroll container is at the top boundary
        const scrollContainer = articlePage.querySelector(
          "[data-scroll-container]",
        ) as HTMLElement | null;
        if (scrollContainer && e.deltaY < 0 && scrollContainer.scrollTop <= 0) {
          // Scrolling up at top → transition back to zoom mode
          e.preventDefault();
          const delta = e.deltaY * 0.001;
          const newZoom = Math.max(0, Math.min(1, currentZoom + delta));
          zoomRef.current = newZoom;
          setZoomLevel(newZoom);

          if (newZoom < 0.85) {
            // Left reading mode — snap will handle the rest
          }
          scheduleSnap();
        }
        // Otherwise: let the browser handle article scrolling naturally
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [isMobile, focusedArticleIndex, scheduleSnap]);

  // ── Click to zoom ────────────────────────────────────────────
  const handlePageClick = useCallback(
    (articleIndex: number) => {
      if (snapTimerRef.current) {
        clearTimeout(snapTimerRef.current);
        snapTimerRef.current = null;
      }
      setFocusedArticleIndex(articleIndex);
      zoomRef.current = 1;
      setZoomLevel(1);
    },
    [],
  );

  // ── Pair articles into spreads (2 per spread) ────────────────
  const spreads = useMemo<Spread[]>(() => {
    const result: Spread[] = [];
    for (let i = 0; i < (issueData?.items.length ?? 0); i += 2) {
      result.push({
        left: issueData!.items[i],
        right: issueData!.items[i + 1] ?? null,
      });
    }
    return result;
  }, [issueData?.items]);

  const totalSpreads = spreads.length;

  // Report totalSpreads up to parent whenever it changes
  useEffect(() => {
    onTotalSpreadsChange(totalSpreads, issueData?.items.length ?? 0);
  }, [totalSpreads, issueData?.items.length, onTotalSpreadsChange]);

  const currentSpread = spreads[spreadIndex] ?? null;

  // ── Navigation: spread-level for desktop, article-level for mobile ──
  const maxIndex = isMobile
    ? (issueData?.items.length ?? 0) - 1
    : totalSpreads - 1;

  const handleNext = useCallback(() => {
    if (spreadIndex < maxIndex) {
      setDirection(1);
      onSpreadIndexChange(spreadIndex + 1);
    }
  }, [spreadIndex, maxIndex, onSpreadIndexChange]);

  const handlePrev = useCallback(() => {
    if (spreadIndex > 0) {
      setDirection(-1);
      onSpreadIndexChange(spreadIndex - 1);
    }
  }, [spreadIndex, onSpreadIndexChange]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;

      // ── Vertical scroll → zoom (mobile only) ─────────────────
      if (isMobile && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 20) {
        const currentZoom = zoomRef.current;
        const delta = dy * 0.001;
        const newZoom = Math.max(0, Math.min(1, currentZoom + delta));

        zoomRef.current = newZoom;
        setZoomLevel(newZoom);

        if (focusedArticleIndex === null || focusedArticleIndex !== spreadIndex) {
          setFocusedArticleIndex(spreadIndex);
        }

        scheduleSnap();
        return;
      }

      // ── Horizontal swipe → navigation ───────────────────────
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
        // Don't switch spreads if zoomed into reading mode
        if (zoomRef.current < 0.85) {
          if (dx < 0) handleNext();
          else handlePrev();
        }
      }
    },
    [handleNext, handlePrev, isMobile, scheduleSnap, spreadIndex, focusedArticleIndex],
  );

  // ── Article scale interpolation ──────────────────────────────
  const baseScale = isMobile ? 0.75 : 0.65;
  const articleScale = baseScale + zoomLevel * (1 - baseScale);
  const isReadingMode = zoomLevel >= 0.85;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
      </div>
    );
  }

  const items = issueData?.items ?? [];
  const isEmpty = items.length === 0;

  if (isEmpty || !issueData) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <p className="text-zinc-400 text-sm">No articles in this issue.</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // MOBILE: single-article cards, swipe between them
  // ═══════════════════════════════════════════════════════════════
  if (isMobile) {
    const isFocused = focusedArticleIndex === spreadIndex;
    const activeZoom = isFocused ? zoomLevel : 0;
    const activeScale = baseScale + activeZoom * (1 - baseScale);
    const activeReading = activeZoom >= 0.85;

    return (
      <div
        ref={containerRef}
        className="flex flex-col h-full w-full select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Single article card with slide animation — fills container, no nav inside */}
        <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden" style={{ perspective: 1000 }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={spreadIndex}
              custom={direction}
              variants={{
                enter: (dir: number) => ({ rotateY: dir * 120, opacity: 0 }),
                center: { rotateY: 0, opacity: 1 },
                exit: (dir: number) => ({ rotateY: dir * -120, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 160, damping: 26 }}
              className="w-full h-full bg-zinc-900 overflow-hidden border-4 relative cursor-pointer"
              style={{
                transformOrigin: "left center",
                boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
                borderColor: `rgba(217, 119, 6, ${0.5 * (1 - activeZoom)})`,
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
              onClick={() => handlePageClick(spreadIndex)}
              data-article-index={spreadIndex}
            >
              <div
                data-scroll-container={activeReading ? "true" : undefined}
                style={{
                  transform: `scale(${activeScale})`,
                  transformOrigin: "top left",
                  width: `${(1 / activeScale) * 100}%`,
                  height: `${(1 / activeScale) * 100}%`,
                  pointerEvents: activeReading ? "auto" : "none",
                  transition: snapTimerRef.current ? "transform 0.3s ease-out, width 0.3s ease-out, height 0.3s ease-out" : "none",
                }}
              >
                <ArticlePage item={items[spreadIndex]} scrollable={activeReading} />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // DESKTOP: two-page spread — paired articles, spine/gutter, 3D page-turn
  // ═══════════════════════════════════════════════════════════════

  // Article index helpers: map spread page → global article index
  const leftArticleIndex = spreadIndex * 2;
  const rightArticleIndex = spreadIndex * 2 + 1;

  // Determine which side is focused
  const leftFocused = focusedArticleIndex === leftArticleIndex;
  const rightFocused = focusedArticleIndex === rightArticleIndex;

  // Each side gets its own effective zoom
  const leftEffectiveZoom = leftFocused ? zoomLevel : 0;
  const rightEffectiveZoom = rightFocused ? zoomLevel : 0;
  const leftScale = baseScale + leftEffectiveZoom * (1 - baseScale);
  const rightScale = baseScale + rightEffectiveZoom * (1 - baseScale);
  const leftReading = leftEffectiveZoom >= 0.85;
  const rightReading = rightEffectiveZoom >= 0.85;

  // Opacity of non-focused side: fade as zoom increases
  const nonFocusedOpacity = 1 - zoomLevel;

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center h-full w-full select-none"
      style={{ perspective: 1000, transformStyle: "preserve-3d", overflow: "visible" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Two-page spread with 3D page-turn ── */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={spreadIndex}
          custom={direction}
          variants={{
            enter: (dir: number) => ({
              rotateY: dir * 120,
              opacity: 0,
              scale: 1,
            }),
            center: {
              rotateY: 0,
              opacity: 1,
              scale: 1,
            },
            exit: (dir: number) => ({
              rotateY: dir * -120,
              opacity: 0,
              scale: 1,
            }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            type: "spring",
            stiffness: 160,
            damping: 26,
          }}
          className="flex items-stretch w-full h-full"
          style={{
            transformOrigin: "left center",
            transformStyle: "preserve-3d",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          {/* ── LEFT PAGE ── */}
          <motion.div
            className="w-1/2 h-full relative cursor-pointer group/left"
            onClick={() => handlePageClick(leftArticleIndex)}
            data-article-index={leftArticleIndex}
            style={{
              boxShadow: "inset -4px 0 8px -4px rgba(0,0,0,0.5)",
              opacity: rightFocused ? nonFocusedOpacity : 1,
              transition: snapTimerRef.current ? "opacity 0.3s ease-out" : "none",
            }}
            animate={{
              opacity: rightFocused ? nonFocusedOpacity : 1,
            }}
          >
            {/* Page border — right edge only (spine side) */}
            <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-amber-600/20 to-transparent" />
            {/* Page shadow at spine */}
            <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-black/40 to-transparent pointer-events-none" />

            <div
              className="w-full h-full bg-zinc-900 border-t border-b border-l flex items-center justify-center overflow-hidden"
              style={{ borderColor: `rgba(217, 119, 6, ${0.4 * (1 - leftEffectiveZoom)})` }}
            >
              <div
                data-scroll-container={leftReading ? "true" : undefined}
                style={{
                  transform: `scale(${leftScale})`,
                  transformOrigin: "top left",
                  width: `${(1 / leftScale) * 100}%`,
                  height: `${(1 / leftScale) * 100}%`,
                  pointerEvents: leftReading ? "auto" : "none",
                  transition: snapTimerRef.current ? "transform 0.3s ease-out, width 0.3s ease-out, height 0.3s ease-out" : "none",
                }}
              >
                <ArticlePage item={currentSpread.left} scrollable={leftReading} />
              </div>
            </div>

            {/* Gradient signal: scroll to read more — hide when zoomed */}
            {!leftReading && (
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />
            )}
          </motion.div>

          {/* ── SPINE / GUTTER ── */}
          <div
            className="w-[6px] flex-shrink-0 relative z-10"
            style={{
              background: "linear-gradient(90deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.4) 100%)",
              boxShadow: "inset 0 0 6px rgba(0,0,0,0.8)",
            }}
          />

          {/* ── RIGHT PAGE ── */}
          <motion.div
            className="w-1/2 h-full relative cursor-pointer group/right"
            onClick={() => {
              if (!currentSpread.right) return;
              handlePageClick(rightArticleIndex);
            }}
            data-article-index={currentSpread.right ? rightArticleIndex : undefined}
            style={{
              boxShadow: "inset 4px 0 8px -4px rgba(0,0,0,0.5)",
              opacity: leftFocused ? nonFocusedOpacity : 1,
              transition: snapTimerRef.current ? "opacity 0.3s ease-out" : "none",
            }}
            animate={{
              opacity: leftFocused ? nonFocusedOpacity : 1,
            }}
          >
            {/* Page border — left edge only (spine side) */}
            <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-amber-600/20 to-transparent" />
            {/* Page shadow at spine */}
            <div className="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />

            {currentSpread.right ? (
              <div
                className="w-full h-full bg-zinc-900 border-t border-b border-r flex items-center justify-center overflow-hidden"
                style={{ borderColor: `rgba(217, 119, 6, ${0.4 * (1 - rightEffectiveZoom)})` }}
              >
                <div
                  data-scroll-container={rightReading ? "true" : undefined}
                  style={{
                    transform: `scale(${rightScale})`,
                    transformOrigin: "top left",
                    width: `${(1 / rightScale) * 100}%`,
                    height: `${(1 / rightScale) * 100}%`,
                    pointerEvents: rightReading ? "auto" : "none",
                    transition: snapTimerRef.current ? "transform 0.3s ease-out, width 0.3s ease-out, height 0.3s ease-out" : "none",
                  }}
                >
                  <ArticlePage item={currentSpread.right} scrollable={rightReading} />
                </div>
              </div>
            ) : (
              /* Empty right page for odd-number last spread */
              <div
                className="w-full h-full bg-zinc-900 border-t border-b border-r flex items-center justify-center"
                style={{ borderColor: `rgba(217, 119, 6, ${0.2 * (1 - rightEffectiveZoom)})` }}
              >
                <span className="text-zinc-600 text-xs italic">—</span>
              </div>
            )}

            {/* Gradient signal: scroll to read more — hide when zoomed */}
            {currentSpread.right && !rightReading && (
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* ── Navigation arrows + counter (inside spread) — hide when zoomed in ── */}
      <motion.div
        className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-4 pb-3 z-10 pointer-events-none"
        animate={{ opacity: zoomLevel < 0.5 ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="pointer-events-auto inline-flex items-center gap-4">
          <button
            onClick={handlePrev}
            disabled={spreadIndex === 0}
            className="flex items-center justify-center w-10 h-10 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:cursor-default transition-colors"
            aria-label="Previous spread"
          >
            <CaretLeft size={22} />
          </button>
          <span className="text-zinc-500 text-sm tabular-nums select-none min-w-[80px] text-center">
            {spreadIndex + 1} / {totalSpreads}
          </span>
          <button
            onClick={handleNext}
            disabled={spreadIndex >= totalSpreads - 1}
            className="flex items-center justify-center w-10 h-10 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:cursor-default transition-colors"
            aria-label="Next spread"
          >
            <CaretRight size={22} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
