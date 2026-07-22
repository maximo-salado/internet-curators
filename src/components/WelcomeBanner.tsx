"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "ic:first-visit";

export function WelcomeBanner() {
  // Start null to avoid hydration mismatch — localStorage only exists client-side
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    setVisible(localStorage.getItem(STORAGE_KEY) === null);
  }, []);

  if (visible !== true) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="mx-4 mt-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            Curated reads from people who know
          </h2>
          <p className="mt-2 text-sm text-zinc-400 max-w-md">
            Discover articles hand-picked by independent curators — journalists, researchers, and domain experts who bring taste and context to what you read.
          </p>
          <a
            href="/about"
            className="mt-3 inline-block text-sm text-zinc-300 underline underline-offset-2 hover:text-zinc-100 transition-colors"
          >
            Learn more
          </a>
        </div>
      </div>
    </div>
  );
}
