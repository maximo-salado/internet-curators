"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
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
  const [isMobile, setIsMobile] = useState(false);

  // ── Zoom state ────────────────────────────────────────────────
  const [zoomLevel, setZoomLevel] = useState(0);
  const [focusedArticleIndex, setFocusedArticleIndex] = useState<number | null>(null);
  const zoomRef = useRef(0);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isZooming = useRef(false);

  // ── Page-turn drag state ──────────────────────────────────────
  const [dragOffset, setDragOffset] = useState(0);
  const [pageSnapState, setPageSnapState] = useState<"idle" | "committing" | "canceling">("idle");
  const dragDirectionRef = useRef<1 | -1>(1);
  const dragActiveRef = useRef(false);
  const preserveReadingModeRef = useRef(false);
  // Target focused article index for the new spread when swiping in reading mode
  const nextReadingFocusRef = useRef<number | null>(null);
  // Track actual article count for mobile bound checks
  const itemsLengthRef = useRef(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
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

  // ── Reset zoom + page-turn drag when spread changes ──────────
  useEffect(() => {
    if (preserveReadingModeRef.current) {
      // Swiping in reading mode — keep zoomed in on the target article
      preserveReadingModeRef.current = false;
      const targetFocus = nextReadingFocusRef.current;
      nextReadingFocusRef.current = null;
      if (targetFocus !== null) {
        setFocusedArticleIndex(targetFocus);
        zoomRef.current = 1;
        setZoomLevel(1);
        setDragOffset(0);
        setPageSnapState("idle");
        dragActiveRef.current = false;
        return;
      }
    }
    setZoomLevel(0);
    setFocusedArticleIndex(null);
    zoomRef.current = 0;
    if (snapTimerRef.current) {
      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
    setDragOffset(0);
    setPageSnapState("idle");
    dragActiveRef.current = false;
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

  // ── Wheel-driven zoom + scroll blend (mobile only) ────────────
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

      // ── Blend factor: 0 = pure zoom, 1 = pure scroll ──
      const blend = currentZoom; // naturally 0→1

      // Total delta to distribute (raw wheel movement)
      const rawDelta = e.deltaY;

      // Zoom portion: fades out as zoomLevel increases — only zoom IN
      const zoomDelta = rawDelta * 0.001 * (1 - blend);
      let newZoom = currentZoom;
      if (zoomDelta > 0) {
        newZoom = Math.min(1, currentZoom + zoomDelta);
      }

      // Track focus
      if (focusedArticleIndex === null || focusedArticleIndex !== articleIndex) {
        setFocusedArticleIndex(articleIndex);
      }

      // Scroll portion: grows as zoomLevel increases
      const scrollContainer = articlePage.querySelector(
        "[data-scroll-container]",
      ) as HTMLElement | null;

      if (scrollContainer && blend > 0) {
        const scrollDelta = rawDelta * blend;
        scrollContainer.scrollTop += scrollDelta;
      }

      // Always prevent default — we control both zoom and scroll
      e.preventDefault();

      zoomRef.current = newZoom;
      setZoomLevel(newZoom);

      scheduleSnap();
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
      onSpreadIndexChange(spreadIndex + 1);
    }
  }, [spreadIndex, maxIndex, onSpreadIndexChange]);

  const handlePrev = useCallback(() => {
    if (spreadIndex > 0) {
      onSpreadIndexChange(spreadIndex - 1);
    }
  }, [spreadIndex, onSpreadIndexChange]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isZooming.current = false;
  }, []);

  // ── Touch-move: zoom (mobile) or page-turn drag (desktop) ─────
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const dy = e.touches[0].clientY - touchStartY.current;
      const dx = e.touches[0].clientX - touchStartX.current;

      // ── Mobile: vertical gesture dominates → zoom + scroll blend ──
      if (isMobile && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
        isZooming.current = true;
        dragActiveRef.current = false;
        e.preventDefault();

        const currentZoom = zoomRef.current;

        // ── Blend factor: 0 = pure zoom, 1 = pure scroll ──
        const blend = currentZoom; // naturally 0→1

        // Raw delta for scroll direction: finger-up (dy<0) = scroll down = positive
        const rawDelta = -dy;

        // Zoom portion: fades out as zoomLevel increases — only zoom IN
        const zoomDelta = rawDelta * 0.005 * (1 - blend);
        let newZoom = currentZoom;
        if (zoomDelta > 0) {
          newZoom = Math.min(1, currentZoom + zoomDelta);
        }

        if (focusedArticleIndex === null || focusedArticleIndex !== spreadIndex) {
          setFocusedArticleIndex(spreadIndex);
        }

        // Scroll portion: grows as zoomLevel increases
        const scrollContainer = containerRef.current?.querySelector(
          "[data-scroll-container]",
        ) as HTMLElement | null;

        if (scrollContainer && blend > 0) {
          const scrollDelta = rawDelta * blend;
          scrollContainer.scrollTop += scrollDelta;
        }

        zoomRef.current = newZoom;
        setZoomLevel(newZoom);
        // No scheduleSnap during move — let the user play with it
      }
      // ── Horizontal gesture dominates → finger-tracked page turn ──
      else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        dragActiveRef.current = true;
        isZooming.current = false;

        const screenWidth = window.innerWidth;
        const offset = -(dx / screenWidth) * 170;
        setDragOffset(offset);
        dragDirectionRef.current = dx > 0 ? -1 : 1;
      }
    },
    [isMobile, spreadIndex, focusedArticleIndex],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // ── Page-turn snap ──
      if (dragActiveRef.current) {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dir = dragDirectionRef.current;

        // Check bounds: can't go past first/last spread (mobile uses article count)
        const targetIndex = spreadIndex + dir;
        const effectiveMax = isMobile ? itemsLengthRef.current - 1 : totalSpreads - 1;
        if (targetIndex < 0 || targetIndex > effectiveMax) {
          // Out of bounds — snap back
          setPageSnapState("canceling");
        } else if (Math.abs(dx) > 80) {
          // Reading mode preservation
          if (zoomRef.current >= 0.85) {
            preserveReadingModeRef.current = true;
            if (isMobile) {
              nextReadingFocusRef.current = targetIndex;
            } else {
              nextReadingFocusRef.current = targetIndex * 2;
            }
          }
          // Commit the page turn
          setPageSnapState("committing");
        } else {
          // Snap back to current page
          setPageSnapState("canceling");
        }
        dragActiveRef.current = false;
        return;
      }

      // If we were zooming, snap on release (spring feel)
      if (isZooming.current) {
        scheduleSnap();
        return;
      }
    },
    [scheduleSnap, spreadIndex, totalSpreads, isMobile],
  );

  // ── Article scale interpolation ──────────────────────────────
  const baseScale = isMobile ? 0.75 : 0.65;
  const articleScale = baseScale + zoomLevel * (1 - baseScale);
  const isReadingMode = zoomLevel >= 0.85;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  const items = issueData?.items ?? [];
  const isEmpty = items.length === 0;
  itemsLengthRef.current = items.length;

  if (isEmpty || !issueData) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <p className="text-zinc-400 text-sm">No articles in this issue.</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // MOBILE: single-article cards — finger-tracked 3D page-turn
  // ═══════════════════════════════════════════════════════════════
  if (isMobile) {
    const isFocused = focusedArticleIndex === spreadIndex;
    const activeZoom = isFocused ? zoomLevel : 0;
    const activeScale = baseScale + activeZoom * (1 - baseScale);
    const activeReading = activeZoom >= 0.85;

    // ── Spine shadow overlay ──────────────────────────────────────
    const mobileShadowOpacity =
      pageSnapState === "idle"
        ? Math.sin(Math.abs(dragOffset) / 170 * Math.PI)
        : 0;
    const mobileIsForward = dragDirectionRef.current === 1;

    const showBehind = dragActiveRef.current || pageSnapState !== "idle";
    const behindIdx = dragDirectionRef.current === 1 ? spreadIndex + 1 : spreadIndex - 1;
    const behindValid = behindIdx >= 0 && behindIdx < items.length;

    return (
      <div
        ref={containerRef}
        className="flex flex-col h-full w-full select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ perspective: 1000, position: "relative" }}
      >
        <style>{`.magazine-mobile-stack > :nth-child(2) { z-index: 10 !important; }`}</style>
        <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden magazine-mobile-stack" style={{ position: "relative" }}>
          {/* Behind card — revealed as current rotates away */}
          {showBehind && behindValid && (
            <div className="w-full h-full bg-zinc-900 overflow-hidden border-4" style={{
              position: "absolute", inset: 0, zIndex: 1,
              borderColor: "rgba(217, 119, 6, 0.4)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
            }}>
              <div
                style={{
                  transform: `scale(${baseScale})`,
                  transformOrigin: "top left",
                  width: `${(1 / baseScale) * 100}%`,
                  height: `${(1 / baseScale) * 100}%`,
                }}
              >
                <ArticlePage item={items[behindIdx]} scrollable={false} />
              </div>
            </div>
          )}

          {/* Current card — rotates with finger in real-time, snaps on release */}
          <motion.div
            key={spreadIndex}
            animate={{
              rotateY:
                pageSnapState === "committing" ? dragDirectionRef.current * -170 :
                pageSnapState === "canceling" ? 0 :
                dragOffset,
              opacity: pageSnapState === "committing" ? 0.35 : 1,
              scale: 1,
            }}
            transition={pageSnapState !== "idle"
              ? { type: "spring", stiffness: 160, damping: 26 }
              : { duration: 0 }}
            className="w-full h-full bg-zinc-900 overflow-hidden border-4 cursor-pointer"
            style={{
              position: "absolute",
              inset: 0,
              transformOrigin: "left center",
              boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
              borderColor: `rgba(217, 119, 6, ${0.5 * (1 - activeZoom)})`,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
            onClick={() => handlePageClick(spreadIndex)}
            data-article-index={spreadIndex}
            onAnimationComplete={() => {
              if (pageSnapState === "committing") {
                onSpreadIndexChange(spreadIndex + dragDirectionRef.current);
                setDragOffset(0);
                setPageSnapState("idle");
                dragActiveRef.current = false;
              } else if (pageSnapState === "canceling") {
                setDragOffset(0);
                setPageSnapState("idle");
                dragActiveRef.current = false;
              }
            }}
          >
            <div
              style={{
                transform: `scale(${activeScale})`,
                transformOrigin: "top left",
                width: `${(1 / activeScale) * 100}%`,
                height: `${(1 / activeScale) * 100}%`,
                pointerEvents: activeReading ? "auto" : "none",
                transition: snapTimerRef.current ? "transform 0.3s ease-out, width 0.3s ease-out, height 0.3s ease-out" : "none",
              }}
            >
              <ArticlePage item={items[spreadIndex]} scrollable={true} />
            </div>

            {/* Gradient signal: scroll to read more — hide when zoomed */}
            {!activeReading && (
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />
            )}

            {/* ── Spine shadow/curve overlay — reduces flat-plane feel during page turn ── */}
            <motion.div
              className="absolute top-0 bottom-0 pointer-events-none z-20"
              animate={{
                opacity: pageSnapState === "idle"
                  ? Math.sin(Math.abs(dragOffset) / 170 * Math.PI)
                  : 0,
              }}
              transition={pageSnapState !== "idle"
                ? { type: "spring", stiffness: 160, damping: 26 }
                : { duration: 0 }}
              style={{
                left: mobileIsForward ? 0 : undefined,
                right: mobileIsForward ? undefined : 0,
                width: 28,
                background: mobileIsForward
                  ? "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.35) 35%, rgba(0,0,0,0.05) 100%)"
                  : "linear-gradient(to left, transparent 0%, rgba(0,0,0,0.35) 35%, rgba(0,0,0,0.05) 100%)",
              }}
            />
            {/* Spine highlight strip */}
            <motion.div
              className="absolute top-0 bottom-0 pointer-events-none z-20"
              animate={{
                opacity: pageSnapState === "idle"
                  ? Math.sin(Math.abs(dragOffset) / 170 * Math.PI)
                  : 0,
              }}
              transition={pageSnapState !== "idle"
                ? { type: "spring", stiffness: 160, damping: 26 }
                : { duration: 0 }}
              style={{
                left: mobileIsForward ? 0 : undefined,
                right: mobileIsForward ? undefined : 0,
                width: 2,
                background: "rgba(255,255,255,0.08)",
              }}
            />
          </motion.div>
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

  // Opacity of non-focused side: fade as zoom increases — reaches 0 at zoom 0.7, well before reading mode
  const nonFocusedOpacity = Math.max(0, 1 - zoomLevel / 0.7);
  const anyFocused = leftFocused || rightFocused;
  const hideNonFocused = anyFocused && zoomLevel >= 0.85;

  // ── Desktop spine shadow overlay ────────────────────────────────
  const desktopShadowOpacity =
    pageSnapState === "idle"
      ? Math.sin(Math.abs(dragOffset) / 170 * Math.PI)
      : 0;
  const desktopIsForward = dragDirectionRef.current === 1;

  // ── Finger-tracked page-turn computed values ──────────────────
  const hideNavArrows = pageSnapState !== "idle" || dragOffset !== 0;

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center h-full w-full select-none magazine-desktop-parent"
      style={{ perspective: 1000, transformStyle: "preserve-3d", overflow: "visible" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Finger-tracked 3D page-turn (z-indices explicit: edge-strip=1, behind=5, current=10) ── */}

      {/* Behind spread — revealed as current page rotates away */}
      {(() => {
        const showBehind = dragActiveRef.current || pageSnapState !== "idle";
        if (!showBehind) return null;
        const behindIdx = dragDirectionRef.current === 1 ? spreadIndex + 1 : spreadIndex - 1;
        const behind = spreads[behindIdx];
        if (!behind) return null;
        return (
          <div className="flex items-stretch w-full h-full" style={{ position: "absolute", inset: 0, zIndex: 5 }}>
            <div className="w-1/2 h-full bg-zinc-900 border-t border-b border-l flex items-center justify-center overflow-hidden"
              style={{ borderColor: "rgba(217, 119, 6, 0.4)" }}>
              <div style={{ transform: `scale(${baseScale})`, transformOrigin: "top left", width: `${(1 / baseScale) * 100}%`, height: `${(1 / baseScale) * 100}%` }}>
                <ArticlePage item={behind.left} scrollable={false} />
              </div>
            </div>
            <div className="w-[6px] flex-shrink-0"
              style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.4) 100%)", boxShadow: "inset 0 0 6px rgba(0,0,0,0.8)" }} />
            <div className="w-1/2 h-full bg-zinc-900 border-t border-b border-r flex items-center justify-center overflow-hidden"
              style={{ borderColor: "rgba(217, 119, 6, 0.4)" }}>
              {behind.right ? <div style={{ transform: `scale(${baseScale})`, transformOrigin: "top left", width: `${(1 / baseScale) * 100}%`, height: `${(1 / baseScale) * 100}%` }}><ArticlePage item={behind.right} scrollable={false} /></div> : <span className="text-zinc-600 text-xs italic">—</span>}
            </div>
          </div>
        );
      })()}

      {/* ── Previous page edge strip — turned page stays in DOM as thin sliver at left edge ── */}
      {spreadIndex > 0 && spreads[spreadIndex - 1] && (() => {
        const edgeSpread = spreads[spreadIndex - 1];
        return (
          <motion.div
            className="flex items-stretch w-full h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            transition={{ duration: 0.4 }}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              transformOrigin: "left center",
              transform: "rotateY(-170deg)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            <div className="w-1/2 h-full bg-zinc-900 border-t border-b border-l flex items-center justify-center overflow-hidden"
              style={{ borderColor: "rgba(217, 119, 6, 0.4)" }}>
              <ArticlePage item={edgeSpread.left} scrollable={false} />
            </div>
            <div className="w-[6px] flex-shrink-0"
              style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.4) 100%)", boxShadow: "inset 0 0 6px rgba(0,0,0,0.8)" }} />
            <div className="w-1/2 h-full bg-zinc-900 border-t border-b border-r flex items-center justify-center overflow-hidden"
              style={{ borderColor: "rgba(217, 119, 6, 0.4)" }}>
              {edgeSpread.right ? <ArticlePage item={edgeSpread.right} scrollable={false} /> : <span className="text-zinc-600 text-xs italic">—</span>}
            </div>
          </motion.div>
        );
      })()}

      {/* Current spread — rotates with finger in real-time, snaps on release */}
      <motion.div
        key={spreadIndex}
        animate={{
          rotateY:
            pageSnapState === "committing" ? dragDirectionRef.current * -170 :
            pageSnapState === "canceling" ? 0 :
            dragOffset,
          opacity: pageSnapState === "committing" ? 0.35 : 1,
          scale: 1,
        }}
        transition={pageSnapState !== "idle"
          ? { type: "spring", stiffness: 160, damping: 26 }
          : { duration: 0 }}
        className="flex items-stretch w-full h-full"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          transformOrigin: "left center",
          transformStyle: "preserve-3d",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
        onAnimationComplete={() => {
          if (pageSnapState === "committing") {
            onSpreadIndexChange(spreadIndex + dragDirectionRef.current);
            setDragOffset(0);
            setPageSnapState("idle");
            dragActiveRef.current = false;
          } else if (pageSnapState === "canceling") {
            setDragOffset(0);
            setPageSnapState("idle");
            dragActiveRef.current = false;
          }
        }}
      >
          {/* ── Spine shadow/curve overlay — reduces flat-plane feel during page turn ── */}
          <motion.div
            className="absolute top-0 bottom-0 pointer-events-none"
            animate={{
              opacity: pageSnapState === "idle"
                ? Math.sin(Math.abs(dragOffset) / 170 * Math.PI)
                : 0,
            }}
            transition={pageSnapState !== "idle"
              ? { type: "spring", stiffness: 160, damping: 26 }
              : { duration: 0 }}
            style={{
              left: desktopIsForward ? 0 : undefined,
              right: desktopIsForward ? undefined : 0,
              width: 24,
              background: desktopIsForward
                ? "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.35) 35%, rgba(0,0,0,0.05) 100%)"
                : "linear-gradient(to left, transparent 0%, rgba(0,0,0,0.35) 35%, rgba(0,0,0,0.05) 100%)",
              zIndex: 25,
            }}
          />
          {/* Spine highlight strip */}
          <motion.div
            className="absolute top-0 bottom-0 pointer-events-none"
            animate={{
              opacity: pageSnapState === "idle"
                ? Math.sin(Math.abs(dragOffset) / 170 * Math.PI)
                : 0,
            }}
            transition={pageSnapState !== "idle"
              ? { type: "spring", stiffness: 160, damping: 26 }
              : { duration: 0 }}
            style={{
              left: desktopIsForward ? 0 : undefined,
              right: desktopIsForward ? undefined : 0,
              width: 2,
              background: "rgba(255,255,255,0.08)",
              zIndex: 25,
            }}
          />
          {/* ── LEFT PAGE ── */}
          {!(hideNonFocused && rightFocused) && (
          <motion.div
            className={hideNonFocused && leftFocused ? "w-full h-full relative cursor-pointer group/left" : "w-1/2 h-full relative cursor-pointer group/left"}
            onClick={() => handlePageClick(leftArticleIndex)}
            data-article-index={leftArticleIndex}
            style={{
              boxShadow: hideNonFocused ? "none" : "inset -4px 0 8px -4px rgba(0,0,0,0.5)",
              opacity: rightFocused ? nonFocusedOpacity : 1,
              visibility: rightFocused && hideNonFocused ? "hidden" : "visible",
              transition: snapTimerRef.current ? "opacity 0.3s ease-out, visibility 0.3s" : "none",
            }}
            animate={{
              opacity: rightFocused ? nonFocusedOpacity : 1,
            }}
          >
            {/* Page border — right edge only (spine side) */}
            {!hideNonFocused && (
              <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-amber-600/20 to-transparent" />
            )}
            {/* Page shadow at spine */}
            {!hideNonFocused && (
              <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-black/40 to-transparent pointer-events-none" />
            )}

            <div
              className="w-full h-full bg-zinc-900 border-t border-b border-l flex items-center justify-center overflow-hidden"
              style={{ borderColor: `rgba(217, 119, 6, ${0.4 * (1 - leftEffectiveZoom)})` }}
            >
              <div
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
          )}

          {/* ── SPINE / GUTTER — hidden when zoomed into reading mode ── */}
          {!hideNonFocused && (
          <div
            className="w-[6px] flex-shrink-0 relative z-10"
            style={{
              background: "linear-gradient(90deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.4) 100%)",
              boxShadow: "inset 0 0 6px rgba(0,0,0,0.8)",
            }}
          />
          )}

          {/* ── RIGHT PAGE ── */}
          {!(hideNonFocused && leftFocused) && (
          <motion.div
            className={hideNonFocused && rightFocused ? "w-full h-full relative cursor-pointer group/right" : "w-1/2 h-full relative cursor-pointer group/right"}
            onClick={() => {
              if (!currentSpread.right) return;
              handlePageClick(rightArticleIndex);
            }}
            data-article-index={currentSpread.right ? rightArticleIndex : undefined}
            style={{
              boxShadow: hideNonFocused ? "none" : "inset 4px 0 8px -4px rgba(0,0,0,0.5)",
              opacity: leftFocused ? nonFocusedOpacity : 1,
              visibility: leftFocused && hideNonFocused ? "hidden" : "visible",
              transition: snapTimerRef.current ? "opacity 0.3s ease-out, visibility 0.3s" : "none",
            }}
            animate={{
              opacity: leftFocused ? nonFocusedOpacity : 1,
            }}
          >
            {/* Page border — left edge only (spine side) */}
            {!hideNonFocused && (
              <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-amber-600/20 to-transparent" />
            )}
            {/* Page shadow at spine */}
            {!hideNonFocused && (
              <div className="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />
            )}

            {currentSpread.right ? (
              <div
                className="w-full h-full bg-zinc-900 border-t border-b border-r flex items-center justify-center overflow-hidden"
                style={{ borderColor: `rgba(217, 119, 6, ${0.4 * (1 - rightEffectiveZoom)})` }}
              >
                <div
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
          )}
        </motion.div>

      {/* ── Navigation arrows + counter (inside spread) — hide when zoomed or dragging ── */}
      <motion.div
        className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-4 pb-3 z-10 pointer-events-none"
        animate={{ opacity: hideNavArrows ? 0 : zoomLevel < 0.5 ? 1 : 0 }}
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
