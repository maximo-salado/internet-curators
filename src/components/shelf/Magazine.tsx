"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { IssueSummary } from "@/app/api/issues/route";
import BookCoverOpen from "./BookCoverOpen";

interface MagazineProps {
  issue: IssueSummary;
  index: number;
  isOpen: boolean;
  onRequestOpen: () => void;
}

type Phase = "closed" | "opening";

export default function Magazine({ issue, isOpen, onRequestOpen }: MagazineProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("closed");
  const [originRect, setOriginRect] = useState<{
    left: number; top: number; width: number; height: number;
  } | null>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const pointerDown = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (isOpen && phase === "closed") {
      // capture the tapped card's on-screen box so the book-open can grow
      // out of it (shared-element feel) instead of popping in at a fixed size
      if (cardRef.current) {
        const r = cardRef.current.getBoundingClientRect();
        const rect = { left: r.left, top: r.top, width: r.width, height: r.height };
        setOriginRect(rect);
        // Stash it so the reader's close animation can shrink back to the exact
        // same size/position (the shelf re-centers on this issue on return).
        try {
          sessionStorage.setItem("mag-card-rect", JSON.stringify(rect));
        } catch {}
      }
      // warm the reader route so the book-open animation masks the load.
      // page=2 → slide index 1 (first content page); cover stays as index 0.
      router.prefetch(`/issue/${issue.number}?page=2`);
      setPhase("opening");
    }
  }, [isOpen, phase, router, issue.number]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
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

  const handleOpenComplete = useCallback(() => {
    // land on the first content page (index 1); swipe right → cover (index 0)
    router.push(`/issue/${issue.number}?page=2`);
  }, [router, issue.number]);

  return (
    <>
      <div className="pointer-events-none flex-[0_0_70%] sm:flex-[0_0_48%] md:flex-[0_0_60%] lg:flex-[0_0_26%] xl:flex-[0_0_20%] min-w-0 px-1.5 first:pl-4 last:pr-4 embla__slide">
        <div className="embla__tilt w-full h-full" style={{ transformStyle: "preserve-3d" }}>
          <button
            ref={cardRef}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            data-issue-number={issue.number}
            className={`pointer-events-auto relative flex flex-col items-center justify-end w-full aspect-[2/3] rounded-xl border-4 transition-all overflow-hidden
              ${isOpen ? "border-zinc-400/60 bg-zinc-800" : "border-zinc-400/50 bg-zinc-800 hover:border-zinc-300/70"}
            `}
            style={{ transformStyle: "preserve-3d", boxShadow: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)" }}
          >
            {issue.leadImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={issue.leadImage} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
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
                {issue.count} {issue.count === 1 ? "article" : "articles"}
              </span>
              <span className="text-lg text-white/55 tracking-wide">
                {new Date(issue.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </button>
        </div>
      </div>

      {/* Book-open overlay is portaled to <body>: rendered in place it would
          inherit the shelf's perspective/preserve-3d/overflow-hidden ancestors,
          which trap `position: fixed` inside the transformed container instead
          of the viewport (so the overlay would be clipped and skewed). */}
      {phase === "opening" &&
        typeof document !== "undefined" &&
        createPortal(
          <BookCoverOpen issue={issue} originRect={originRect} onComplete={handleOpenComplete} />,
          document.body,
        )}
    </>
  );
}
