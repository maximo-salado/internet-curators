"use client";

import { useEffect, useRef, useState } from "react";

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  coverImage?: string;
  issueNumber: number | string;
  onComplete: () => void;
}

/**
 * Reverse of BookCoverOpen — closes a magazine back to the shelf, in three beats:
 *   0 → the current page, fullscreen (cover swung open, off-screen left)
 *   1 → the page shrinks down to a centered card-sized box
 *   2 → the cover swings shut over it (rotateY back to 0)
 * then we navigate to the shelf. Portaled to <body> by the caller.
 */
export default function BookCoverClose({ coverImage, issueNumber, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onComplete();
  };

  // Target card box: centered, matching the shelf card proportions.
  const [card] = useState<Rect>(() => {
    if (typeof window === "undefined") return { left: 0, top: 0, width: 300, height: 450 };
    const w = Math.min(window.innerWidth * 0.75, 320);
    const h = w * 1.5;
    return { left: (window.innerWidth - w) / 2, top: (window.innerHeight - h) / 2, width: w, height: h };
  });

  useEffect(() => {
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

  const shrunk = step >= 1;
  const coverClosed = step >= 2;

  return (
    <div className="fixed inset-0 z-[70] bg-black" style={{ perspective: "1600px" }}>
      <div
        onTransitionEnd={(e) => {
          if (step === 1 && e.propertyName === "width") setStep(2);
        }}
        style={{
          position: "fixed",
          left: shrunk ? card.left : 0,
          top: shrunk ? card.top : 0,
          width: shrunk ? card.width : "100vw",
          height: shrunk ? card.height : "100vh",
          transformStyle: "preserve-3d",
          transition:
            "left 440ms ease-out, top 440ms ease-out, width 440ms ease-out, height 440ms ease-out",
        }}
      >
        {/* Page behind the cover */}
        <div
          className="absolute inset-0 overflow-hidden bg-zinc-900"
          style={{ boxShadow: "inset 10px 0 28px rgba(0,0,0,0.5)" }}
        >
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <span className="font-serif text-5xl font-bold text-zinc-600">#{issueNumber}</span>
            <span className="text-xs uppercase tracking-[0.25em] text-zinc-500">Issue</span>
          </div>
        </div>

        {/* Cover — swings shut over the page */}
        <div
          onTransitionEnd={(e) => {
            if (coverClosed && e.propertyName === "transform") finish();
          }}
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "left center",
            transform: coverClosed ? "rotateY(0deg)" : "rotateY(-168deg)",
            transition: "transform 640ms cubic-bezier(0.42, 0.04, 0.22, 1)",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Front face — cover artwork */}
          <div
            className="absolute inset-0 overflow-hidden rounded-lg border-2 border-zinc-400/40 bg-zinc-800"
            style={{ backfaceVisibility: "hidden", boxShadow: "0 12px 44px rgba(0,0,0,0.6)" }}
          >
            {coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-zinc-700" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <div className="absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-black/55 to-transparent" />
          </div>

          {/* Back face — inside cover */}
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
