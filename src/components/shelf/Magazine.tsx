"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import lottie from "lottie-web";
import type { IssueSummary } from "@/app/api/issues/route";
import closeAnim from "@/lottie/close-x.json";

const LottieOpen = dynamic(() => import("./LottieOpen"), { ssr: false });
const LottieClose = dynamic(() => import("./LottieClose"), { ssr: false });

interface MagazineProps {
  issue: IssueSummary;
  index: number;
  isOpen: boolean;
  onRequestOpen: () => void;
  onRequestClose: () => void;
}

type Phase = "closed" | "opening" | "closing";

export default function Magazine({
  issue,
  isOpen,
  onRequestOpen,
  onRequestClose,
}: MagazineProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("closed");
  const closeLottieRef = useRef<HTMLDivElement>(null);
  const closeAnimRef = useRef<ReturnType<typeof lottie.loadAnimation> | null>(null);
  const pointerDown = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (isOpen && phase === "closed") setPhase("opening");
  }, [isOpen, phase]);

  useEffect(() => {
    if (!isOpen && phase === "opening") setPhase("closing");
  }, [isOpen, phase]);

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

  const handleOpenComplete = useCallback(() => {
    router.push(`/issue/${issue.number}?page=0`);
  }, [router, issue.number]);

  const handleCloseComplete = useCallback(() => {
    setPhase("closed");
  }, []);

  const handleClose = useCallback(() => {
    onRequestClose();
  }, [onRequestClose]);

  // Close button Lottie
  useEffect(() => {
    if (phase === "closing" && closeLottieRef.current) {
      const anim = lottie.loadAnimation({
        container: closeLottieRef.current,
        animationData: closeAnim,
        renderer: "svg",
        loop: false,
        autoplay: false,
      });
      closeAnimRef.current = anim;
      return () => anim.destroy();
    }
  }, [phase]);

  return (
    <>
      <div className="flex-[0_0_70%] sm:flex-[0_0_48%] md:flex-[0_0_60%] lg:flex-[0_0_26%] xl:flex-[0_0_20%] min-w-0 px-1.5 first:pl-4 last:pr-4 embla__slide">
        <div className="embla__tilt w-full h-full" style={{ transformStyle: "preserve-3d" }}>
          <button
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            data-issue-number={issue.number}
            className={`relative flex flex-col items-center justify-end w-full aspect-[2/3] rounded-xl border-4 transition-all overflow-hidden
              ${isOpen ? "border-zinc-400/60 bg-zinc-800" : "border-zinc-400/50 bg-zinc-800 hover:border-zinc-300/70"}
            `}
            style={{ transformStyle: "preserve-3d", boxShadow: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)" }}
          >
            {issue.leadImage ? (
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

      {phase === "opening" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black">
          <LottieOpen onComplete={handleOpenComplete} />
        </div>
      )}

      {phase === "closing" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black">
          <LottieClose onComplete={handleCloseComplete} />
          <button
            onClick={handleClose}
            className="fixed z-[63] top-4 right-4 w-12 h-12 flex items-center justify-center"
            aria-label="Close"
          >
            <div ref={closeLottieRef} style={{ width: 24, height: 24 }} />
          </button>
        </div>
      )}
    </>
  );
}
