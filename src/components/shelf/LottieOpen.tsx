"use client";

import { useEffect, useRef } from "react";
import lottie from "lottie-web";
import coverOpenAnim from "@/lottie/cover-open.json";

interface Props {
  onComplete: () => void;
}

export default function LottieOpen({ onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const didNavigate = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const anim = lottie.loadAnimation({
      container: containerRef.current,
      animationData: coverOpenAnim,
      renderer: "svg",
      loop: false,
      autoplay: true,
    });
    anim.addEventListener("complete", () => {
      if (!didNavigate.current) {
        didNavigate.current = true;
        onComplete();
      }
    });
    return () => anim.destroy();
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      style={{ width: "min(75vw, 320px)", aspectRatio: "2/3" }}
    />
  );
}
