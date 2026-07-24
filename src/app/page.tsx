"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { DiscoverFeed } from "@/components/DiscoverFeed";
import { FiltersBar } from "@/components/FiltersBar";
import { useAuth } from "@/hooks/useAuth";

export default function HomePage() {
  const searchParams = useSearchParams();
  const tagSlugs =
    searchParams.get("tags")?.split(",").filter(Boolean) ?? [];

  const { user, loading: authLoading } = useAuth();
  const isLoggedIn = !!user && !authLoading;

  const feedRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToFeed = () => {
    feedRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const [filterSlugs, setFilterSlugs] = useState<string[]>(tagSlugs);
  const tagSlugsKey = tagSlugs.join(",");

  // Sync with URL params
  useEffect(() => {
    setFilterSlugs(tagSlugs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagSlugsKey]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section — only for anonymous users */}
      {!isLoggedIn && (
      <section className="relative flex flex-col justify-center min-h-screen px-4 pb-16">
        {/* Top bar — Logo + Sign In */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4 md:px-6 md:py-5">
          <Link href="/" className="text-base font-semibold tracking-tight text-zinc-100">
            Internet Curators
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Sign In
          </Link>
        </div>

        {/* Hero content */}
        <div className="flex flex-col items-start max-w-2xl mx-auto w-full mt-20 md:mt-32">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-zinc-100 leading-tight">
            Free your feed
          </h1>
          <p className="mt-4 md:mt-6 text-lg md:text-xl text-zinc-400 max-w-lg">
            Discover articles hand-picked by independent curators —
            journalists, researchers, and domain experts who bring taste and
            context to what you read.
          </p>
          <button
            onClick={scrollToFeed}
            className="mt-8 inline-flex items-center gap-1 text-base text-zinc-300 hover:text-zinc-100 transition-colors group"
          >
            Learn more
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="transition-transform group-hover:translate-x-1"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Scroll down prompt — fades on scroll */}
        <div
          className={`absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-500 ${
            scrolled ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <p className="text-sm text-zinc-600 animate-bounce">↓ Scroll down</p>
        </div>
      </section>
      )}

      {/* Feed Section */}
      <section
        ref={feedRef}
        id="feed"
        className="flex-1 border-t border-zinc-800"
      >
        <div className="mx-auto w-full max-w-2xl py-4 mb-16">
          <FiltersBar
            onFilterChange={setFilterSlugs}
            activeTagSlugs={filterSlugs}
          />

          <div className="mt-4">
            <DiscoverFeed tagSlugs={filterSlugs} isLoggedIn={isLoggedIn} />
          </div>
        </div>
      </section>
    </div>
  );
}
