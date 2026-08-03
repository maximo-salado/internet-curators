"use client";

import { useEffect } from "react";
import gsap from "gsap";

const OPEN_KEY = "mag-open-from";

function animateOpen() {
  const raw = sessionStorage.getItem(OPEN_KEY);
  if (!raw) return;
  sessionStorage.removeItem(OPEN_KEY);
  const from: {
    top: number; left: number; width: number; height: number;
    image: string | null; number: number;
  } = JSON.parse(raw);

  const bg = from.image
    ? `url(${from.image}) center/cover no-repeat`
    : "#111";

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed; z-index: 9999;
    background: ${bg};
    top: ${from.top}px; left: ${from.left}px;
    width: ${from.width}px; height: ${from.height}px;
    border-radius: 8px; will-change: transform;
    border: 1px solid #333;
  `;
  document.body.appendChild(overlay);

  gsap.to(overlay, {
    top: 0, left: 0,
    width: "100vw", height: "100dvh",
    borderRadius: "0px",
    borderWidth: "0px",
    duration: 0.45,
    ease: "power3.inOut",
    onComplete: () => {
      gsap.to(overlay, { opacity: 0, duration: 0.25,
        onComplete: () => overlay.remove() });
    },
  });
}

export default function ReaderTemplate({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => { animateOpen(); }, []);
  return <>{children}</>;
}
