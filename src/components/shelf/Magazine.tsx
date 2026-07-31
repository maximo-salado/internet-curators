"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { IssueSummary } from "@/app/api/issues/route";
import MagazineSpread from "./MagazineSpread";

interface MagazineProps {
  issue: IssueSummary;
  index: number;
  isOpen: boolean;
  onRequestOpen: () => void;
  onRequestClose: () => void;
}

type Phase = "closed" | "opening" | "open" | "closing";

/**
 * Compute the target position & size for the cover when zoomed in.
 * 2:3 aspect ratio, constrained to 88% vw or 85% vh, centered.
 */
function computeCenterTarget(): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxW = Math.min(vw * 0.88, vh * 0.85 * (2 / 3));
  const width = maxW;
  const height = width * 1.5;
  const left = (vw - width) / 2;
  const top = (vh - height) / 2;
  return { left, top, width, height };
}

/** Linear interpolation */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export default function Magazine({
  issue,
  index,
  isOpen,
  onRequestOpen,
  onRequestClose,
}: MagazineProps) {
  const [phase, setPhase] = useState<Phase>("closed");
  const cardRef = useRef<HTMLButtonElement>(null);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);
  const pointerDown = useRef<{ x: number; y: number } | null>(null);

  // ── Pagination state (lifted from MagazineSpread) ──
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [totalSpreads, setTotalSpreads] = useState(0);
  const [totalArticles, setTotalArticles] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // ── Zoom state (driven by MagazineSpread scroll) ──
  const [zoomLevel, setZoomLevel] = useState(0);
  const [focusedArticleIndex, setFocusedArticleIndex] = useState<number | null>(null);

  // Reset spreadIndex when issue changes
  useEffect(() => {
    setSpreadIndex(0);
  }, [issue.number]);

  // Detect mobile for counter display
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleTotalSpreadsChange = useCallback((totalSpreads: number, totalArticles: number) => {
    setTotalSpreads(totalSpreads);
    setTotalArticles(totalArticles);
  }, []);

  const handleZoomChange = useCallback(
    (zoom: number, focusedIndex: number | null) => {
      setZoomLevel(zoom);
      setFocusedArticleIndex(focusedIndex);
    },
    [],
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerDown.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerDown.current) return;
      const dx = Math.abs(e.clientX - pointerDown.current.x);
      const dy = Math.abs(e.clientY - pointerDown.current.y);
      pointerDown.current = null;
      if (dx < 5 && dy < 5) {
        e.stopPropagation();
        onRequestOpen();
      }
    },
    [onRequestOpen],
  );

  // ── Phase transitions ──────────────────────────────────────────

  // closed → opening when isOpen becomes true
  useEffect(() => {
    if (isOpen && phase === "closed") {
      if (cardRef.current) {
        setCardRect(cardRef.current.getBoundingClientRect());
      }
      setPhase("opening");
      return;
    }
  }, [isOpen, phase]);

  // open / opening → closing when isOpen becomes false
  useEffect(() => {
    if (!isOpen && (phase === "open" || phase === "opening")) {
      setPhase("closing");
      return;
    }
  }, [isOpen, phase]);

  // Safety timeout: if onAnimationComplete doesn't fire, still advance phase
  useEffect(() => {
    if (phase === "opening") {
      const timer = setTimeout(() => {
        setPhase((prev) => (prev === "opening" ? "open" : prev));
      }, 900);
      return () => clearTimeout(timer);
    }
    if (phase === "closing") {
      const timer = setTimeout(() => {
        setPhase((prev) => (prev === "closing" ? "closed" : prev));
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // ── Animation completion callbacks ─────────────────────────────

  /** Called when the cover zoom-in animation settles — advance to open (flip). */
  const handleZoomInComplete = useCallback(() => {
    setPhase((prev) => (prev === "opening" ? "open" : prev));
  }, []);

  /** Called when the cover zoom-out animation settles — return to closed. */
  const handleZoomOutComplete = useCallback(() => {
    setPhase((prev) => (prev === "closing" ? "closed" : prev));
  }, []);

  // ── Derived layout values ──────────────────────────────────────

  const centerTarget = useMemo(() => computeCenterTarget(), []);

  /** Card-relative position (where the cover starts/ends the zoom). */
  const cardLayout = useMemo(() => {
    if (!cardRect) return null;
    return {
      left: cardRect.left,
      top: cardRect.top,
      width: cardRect.width,
      height: cardRect.height,
    };
  }, [cardRect]);

  // ── Pagination helpers ─────────────────────────────────────────

  const isDesktop = !isMobile;
  const displayIndex = spreadIndex + 1;
  const displayTotal = isDesktop ? totalSpreads : totalArticles;
  // On desktop: spread counter. On mobile: article counter.
  const counterLabel = isDesktop
    ? `Spread ${displayIndex} / ${displayTotal}`
    : `Article ${displayIndex} / ${displayTotal}`;

  const handlePrevClick = useCallback(() => {
    setSpreadIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextClick = useCallback(() => {
    setSpreadIndex((prev) => {
      const max = isMobile ? totalArticles - 1 : totalSpreads - 1;
      return Math.min(max, prev + 1);
    });
  }, [isMobile, totalArticles, totalSpreads]);

  const atStart = spreadIndex === 0;
  const atEnd = isMobile ? spreadIndex >= totalArticles - 1 : spreadIndex >= totalSpreads - 1;

  // ── Handlers ───────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    onRequestClose();
  }, [onRequestClose]);

  // ── Render ─────────────────────────────────────────────────────

  const isExpanded =
    phase === "open" || phase === "opening" || phase === "closing";

  const overlay = useMemo(() => {
    if (!isExpanded || !cardLayout) return null;

    const target = centerTarget;

    // The cover wrapper: animates left/top/width/height for zoom
    const coverAnimateTarget =
      phase === "closing"
        ? {
            left: cardLayout.left,
            top: cardLayout.top,
            width: cardLayout.width,
            height: cardLayout.height,
            borderRadius: 12,
          }
        : {
            left: target.left,
            top: target.top,
            width: target.width,
            height: target.height,
            borderRadius: 12,
          };

    // ── Spread container interpolation for scroll-driven zoom ────
    // Desktop: spread starts as 2× target width, clamped to fit viewport
    const VIEWPORT_PADDING = 32;
    const maxSpreadWidth = window.innerWidth - VIEWPORT_PADDING;
    const maxSpreadHeight = window.innerHeight - VIEWPORT_PADDING;

    let spreadStartWidth: number;
    let spreadStartHeight: number;
    let spreadStartLeft: number;
    let spreadStartTop: number;

    if (isMobile) {
      spreadStartWidth = target.width;
      spreadStartHeight = target.height;
      spreadStartLeft = target.left;
      spreadStartTop = target.top;
    } else {
      // Two-page spread: 2× width, 1× height (4:3 aspect)
      const idealWidth = target.width * 2;
      const idealHeight = target.height;

      // Scale down to fit within viewport if needed (don't upscale)
      const widthScale = maxSpreadWidth / idealWidth;
      const heightScale = maxSpreadHeight / idealHeight;
      const scale = Math.min(widthScale, heightScale, 1);

      spreadStartWidth = idealWidth * scale;
      spreadStartHeight = idealHeight * scale;
      spreadStartLeft = (window.innerWidth - spreadStartWidth) / 2;
      spreadStartTop = (window.innerHeight - spreadStartHeight) / 2;
    }

    const spreadEndLeft = 0;
    const spreadEndTop = 0;
    const spreadEndWidth = window.innerWidth;
    const spreadEndHeight = window.innerHeight;

    const spreadZoomStyle =
      phase === "open"
        ? {
            left: `${lerp(spreadStartLeft, spreadEndLeft, zoomLevel)}px`,
            top: `${lerp(spreadStartTop, spreadEndTop, zoomLevel)}px`,
            width: `${lerp(spreadStartWidth, spreadEndWidth, zoomLevel)}px`,
            height: `${lerp(spreadStartHeight, spreadEndHeight, zoomLevel)}px`,
            borderRadius: `${lerp(12, 0, zoomLevel)}px`,
            transition: zoomLevel === 0 || zoomLevel === 1 ? "all 0.3s ease-out" : "none",
          }
        : {};

    return (
      <AnimatePresence>
        {/* ── Backdrop ──────────────────────────────────────────── */}
        <motion.div
          key="magazine-backdrop"
          className="fixed inset-0 z-[60] bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />

        {/* ── Spread content (behind cover, revealed on flip) ───── */}
        <motion.div
          key="magazine-spread"
          className="fixed z-[61] overflow-hidden"
          style={{
            boxShadow:
              "0 25px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
            pointerEvents: phase === "open" ? "auto" : "none",
            ...spreadZoomStyle,
          }}
          initial={{
            left: spreadStartLeft,
            top: spreadStartTop,
            width: spreadStartWidth,
            height: spreadStartHeight,
            borderRadius: 12,
            opacity: 0,
          }}
          animate={{
            left:
              phase === "open"
                ? undefined // controlled by spreadZoomStyle
                : spreadStartLeft,
            top: phase === "open" ? undefined : spreadStartTop,
            width:
              phase === "open"
                ? undefined
                : spreadStartWidth,
            height: phase === "open" ? undefined : spreadStartHeight,
            borderRadius: phase === "open" ? undefined : 12,
            opacity: phase === "open" ? 1 : 0,
          }}
          exit={{
            left: spreadStartLeft,
            top: spreadStartTop,
            width: spreadStartWidth,
            height: spreadStartHeight,
            borderRadius: 12,
            opacity: 0,
          }}
          transition={{
            duration: 0.35,
            delay: 0,
            ease: "easeOut",
          }}
        >
          <MagazineSpread
            issueNumber={issue.number}
            spreadIndex={spreadIndex}
            onSpreadIndexChange={setSpreadIndex}
            onTotalSpreadsChange={handleTotalSpreadsChange}
            onZoomChange={handleZoomChange}
          />
        </motion.div>

        {/* ── Pagination pill — outside spread container, same position as bookmark CTA ── */}
        <motion.div
          key="magazine-pagination"
          className="fixed bottom-6 inset-x-0 z-[63] flex justify-center pointer-events-none"
          initial={{ opacity: 0, y: 12 }}
          animate={{
            opacity: phase === "open" && zoomLevel < 0.5 ? 1 : 0,
            y: phase === "open" && zoomLevel < 0.5 ? 0 : 12,
          }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25, delay: 0.2 }}
        >
          <div className="pointer-events-auto inline-flex items-center gap-3 px-5 py-2.5 bg-zinc-800 text-amber-400 rounded-full text-sm font-medium shadow-lg shadow-black/40 border border-zinc-700/50">
            <button
              onClick={handlePrevClick}
              disabled={atStart}
              className="flex items-center justify-center text-amber-400 hover:text-amber-300 disabled:opacity-20 disabled:cursor-default transition-colors"
              aria-label="Previous spread"
            >
              <CaretLeft size={16} />
            </button>
            <span className="tabular-nums min-w-[100px] text-center select-none">
              {counterLabel}
            </span>
            <button
              onClick={handleNextClick}
              disabled={atEnd}
              className="flex items-center justify-center text-amber-400 hover:text-amber-300 disabled:opacity-20 disabled:cursor-default transition-colors"
              aria-label="Next spread"
            >
              <CaretRight size={16} />
            </button>
          </div>
        </motion.div>

        {/* ── L3 reading-mode header — RSSMag logo + issue number ── */}
        <motion.div
          key="magazine-l3-header"
          className="fixed top-0 inset-x-0 z-[63] flex justify-center pointer-events-none pt-4"
          initial={{ opacity: 0 }}
          animate={{
            opacity: phase === "open" && zoomLevel >= 0.5 ? 1 : 0,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <span className="text-2xl text-white/80 font-serif">
            RSSMag
            <span className="font-light">
              {" "}· #{issue.number}
            </span>
            {focusedArticleIndex != null && (
              <span className="font-light">
                {" "}— p.{focusedArticleIndex + 1}
              </span>
            )}
          </span>
        </motion.div>

        {/* ── Cover (zooms THEN flips — Paper-style) ────────────── */}
        <motion.div
          key="magazine-cover"
          className="fixed z-[62]"
          style={{
            boxShadow:
              "0 25px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
            transformStyle: "preserve-3d",
            overflow: "hidden",
            pointerEvents: phase === "open" ? "none" : "auto",
          }}
          initial={{
            left: cardLayout.left,
            top: cardLayout.top,
            width: cardLayout.width,
            height: cardLayout.height,
            borderRadius: 12,
          }}
          animate={coverAnimateTarget}
          exit={{
            left: cardLayout.left,
            top: cardLayout.top,
            width: cardLayout.width,
            height: cardLayout.height,
            borderRadius: 12,
          }}
          transition={{
            type: "spring",
            stiffness: 160,
            damping: 26,
            mass: 1.2,
          }}
          onAnimationComplete={
            phase === "opening"
              ? handleZoomInComplete
              : phase === "closing"
                ? handleZoomOutComplete
                : undefined
          }
        >
          <motion.div
            className="w-full h-full border-4 border-amber-600/50 relative overflow-hidden"
            initial={{ rotateY: 0 }}
            animate={{
              rotateY:
                phase === "open"
                  ? -160
                  : phase === "closing"
                    ? 0
                    : 0,
            }}
            transition={{
              type: "spring",
              stiffness: 160,
              damping: 26,
              mass: 1.2,
            }}
            style={{
              transformOrigin: "left center",
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              boxShadow:
                "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* Lead image */}
            {issue.leadImage ? (
              <img
                src={issue.leadImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-zinc-700" />
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

            {/* Issue number watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="font-serif font-bold text-6xl sm:text-7xl text-white/12 select-none">
                #{issue.number}
              </span>
            </div>

            {/* Bottom metadata */}
            <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center gap-1 pb-8 px-6 pointer-events-none">
              <span className="text-lg text-white/90 font-medium tracking-wider uppercase">
                {issue.count}{" "}
                {issue.count === 1 ? "article" : "articles"}
              </span>
              <span className="text-lg text-white/55 tracking-wide">
                {new Date(issue.date + "T00:00:00").toLocaleDateString(
                  "en-US",
                  {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  },
                )}
              </span>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Close button — always on top ──────────────────────── */}
        <motion.button
          key="magazine-close"
          onClick={handleClose}
          className="fixed z-[63] top-4 right-4 w-12 h-12 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          aria-label="Close magazine"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
        >
          <X size={28} />
        </motion.button>
      </AnimatePresence>
    );
  }, [
    isExpanded,
    cardLayout,
    centerTarget,
    phase,
    issue,
    spreadIndex,
    totalSpreads,
    isMobile,
    zoomLevel,
    handleClose,
    handleZoomInComplete,
    handleZoomOutComplete,
    handleTotalSpreadsChange,
    handleZoomChange,
    handlePrevClick,
    handleNextClick,
    counterLabel,
    atStart,
    atEnd,
  ]);

  return (
    <>
      {/* ── Cover card — Level 1 shelf ──────────────────────────── */}
      <div className="flex-[0_0_70%] sm:flex-[0_0_48%] md:flex-[0_0_50%] lg:flex-[0_0_26%] xl:flex-[0_0_20%] min-w-0 px-1.5 first:pl-4 last:pr-4 embla__slide">
        <div
          className="embla__tilt w-full h-full"
          style={{ transformStyle: "preserve-3d" }}
        >
          <button
            ref={cardRef}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            data-issue-number={issue.number}
            className={`relative flex flex-col items-center justify-end w-full aspect-[2/3] rounded-xl border-4 transition-all overflow-hidden
              ${
                isOpen
                  ? "border-amber-500/60 bg-zinc-800"
                  : "border-amber-600/50 bg-zinc-800 hover:border-amber-500/70"
              }
            `}
            style={{
              transformStyle: "preserve-3d",
              boxShadow:
                "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {issue.leadImage ? (
              <img
                src={issue.leadImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 bg-zinc-700" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="font-serif font-bold text-3xl sm:text-4xl text-white/12 select-none">
                #{issue.number}
              </span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-0.5 pb-4 px-3 w-full pointer-events-none">
              <span className="text-lg text-white/90 font-medium tracking-wider uppercase">
                {issue.count}{" "}
                {issue.count === 1 ? "article" : "articles"}
              </span>
              <span className="text-lg text-white/55 tracking-wide">
                {new Date(issue.date + "T00:00:00").toLocaleDateString(
                  "en-US",
                  {
                    month: "short",
                    day: "numeric",
                  },
                )}
              </span>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </button>
        </div>
      </div>

      {/* Overlay — portaled to body to escape perspective stacking context */}
      {overlay && createPortal(overlay, document.body)}
    </>
  );
}
