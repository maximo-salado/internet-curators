"use client";

import { useEffect, useRef, useState } from "react";
import type { IssueSummary } from "@/app/api/issues/route";

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  issue: IssueSummary;
  originRect?: Rect | null;
  onComplete: () => void;
}

/**
 * CSS 3D "book open" transition, in three beats:
 *   0 → the tapped cover, at its exact shelf position/size (shared-element feel)
 *   1 → the cover hinges open on its left spine (rotateY, real perspective)
 *   2 → the revealed first page zooms up to fill the screen, then we navigate
 * Pure CSS transforms — no Lottie. Caller portals this to <body> so it escapes
 * the shelf's perspective/preserve-3d/overflow-hidden ancestors.
 */
export default function BookCoverOpen({ issue, originRect, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onComplete();
  };

  // Starting box: the tapped card, or a centered fallback.
  const [base] = useState<Rect>(() => {
    if (originRect) return originRect;
    if (typeof window === "undefined") return { left: 0, top: 0, width: 300, height: 450 };
    const w = Math.min(window.innerWidth * 0.75, 320);
    const h = w * 1.5;
    return { left: (window.innerWidth - w) / 2, top: (window.innerHeight - h) / 2, width: w, height: h };
  });

  useEffect(() => {
    // double rAF so the closed/origin frame paints before we animate
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setStep(1));
    });
    const t = setTimeout(finish, 2400); // safety net
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomed = step === 2;

  return (
    <div className="fixed inset-0 z-[60] bg-black" style={{ perspective: "1600px" }}>
      <div
        onTransitionEnd={(e) => {
          if (zoomed && e.propertyName === "width") finish();
        }}
        style={{
          position: "fixed",
          left: zoomed ? 0 : base.left,
          top: zoomed ? 0 : base.top,
          width: zoomed ? "100vw" : base.width,
          height: zoomed ? "100vh" : base.height,
          transformStyle: "preserve-3d",
          transition:
            "left 460ms ease-in, top 460ms ease-in, width 460ms ease-in, height 460ms ease-in",
        }}
      >
        {/* Revealed first page (behind the cover). Kept near-black to match the
            reader's loading screen so the hand-off doesn't flash/jar. */}
        <div
          className="absolute inset-0 overflow-hidden bg-black"
          style={{ boxShadow: "inset 12px 0 32px rgba(0,0,0,0.7)" }}
        >
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <span className="font-serif text-5xl font-bold text-zinc-800">#{issue.number}</span>
            <span className="text-xs uppercase tracking-[0.25em] text-zinc-700">Issue</span>
          </div>
        </div>

        {/* Cover — hinges fully open on the left spine (flat, not left ajar), as
            the clear "opening" beat before the page zooms up. */}
        <div
          onTransitionEnd={(e) => {
            if (step === 1 && e.propertyName === "transform") setStep(2);
          }}
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "left center",
            transform: step >= 1 ? "rotateY(-180deg)" : "rotateY(0deg)",
            transition: "transform 780ms cubic-bezier(0.33, 0, 0.15, 1)",
            transformStyle: "preserve-3d",
            willChange: "transform",
          }}
        >
          {/* Front face — cover artwork (matches the shelf card) */}
          <div
            className="absolute inset-0 overflow-hidden rounded-lg border-2 border-zinc-400/40 bg-zinc-800"
            style={{ backfaceVisibility: "hidden", boxShadow: "0 12px 44px rgba(0,0,0,0.6)" }}
          >
            {issue.leadImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={issue.leadImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-zinc-700" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <div className="absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-black/55 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-0.5 pb-3">
              <span className="text-xs uppercase tracking-wider text-white/90">
                {issue.count} {issue.count === 1 ? "article" : "articles"}
              </span>
            </div>
          </div>

          {/* Back face — inside of the cover, shown as it swings past 90° */}
          <div
            className="absolute inset-0 rounded-lg bg-zinc-900"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              boxShadow: "inset 0 0 40px rgba(0,0,0,0.6)",
            }}
          >
            <div className="absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-black/50 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
