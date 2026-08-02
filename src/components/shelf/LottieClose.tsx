"use client";

import { useEffect, useRef } from "react";
import lottie from "lottie-web";
import coverCloseAnim from "@/lottie/cover-close.json";

interface Props {
  onComplete: () => void;
}

export default function LottieClose({ onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const anim = lottie.loadAnimation({
      container: containerRef.current,
      animationData: coverCloseAnim,
      renderer: "svg",
      loop: false,
      autoplay: true,
    });
    anim.addEventListener("complete", () => onComplete());
    return () => anim.destroy();
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      style={{ width: "min(75vw, 320px)", aspectRatio: "2/3" }}
    />
  );
}
