"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import CoverCard from "./CoverCard";
import { groupIssuesByWeek, getMonthOptions, type WeekGroup } from "@/lib/weeks";
import type { IssueSummary } from "@/app/api/issues/route";
import { BookmarkSimple, DotsThree, CaretDown } from "@phosphor-icons/react";
import NavDrawer from "@/components/reader/NavDrawer";
import useEmblaCarousel from "embla-carousel-react";

function isFinished(issueNumber: number): boolean {
  try {
    return localStorage.getItem(`rssmag-completed-${issueNumber}`) === "true";
  } catch {
    return false;
  }
}

type Level = "shelf" | "spread" | "article";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function IssueShelf() {
  const [weeks, setWeeks] = useState<WeekGroup[]>([]);
  const [currentWeekIdx, setCurrentWeekIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [resumeHref, setResumeHref] = useState<string | null>(null);

  const [level, setLevel] = useState<Level>("shelf");
  const [openIssue, setOpenIssue] = useState<number | null>(null);
  const [openArticleIndex, setOpenArticleIndex] = useState(0);
  const [coverRect, setCoverRect] = useState<Rect | null>(null);

  const [zooming, setZooming] = useState(false);
  const [navigateTo, setNavigateTo] = useState<string | null>(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    containScroll: "trimSnaps",
    skipSnaps: false,
  });

  const lastTapRef = useRef(0);
  const initializedRef = useRef(false);
  const currentWeek = weeks[currentWeekIdx] ?? null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("rssmag-resume");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data?.issueNumber === "number" && typeof data?.index === "number") {
        setResumeHref(`/issue/${data.issueNumber}?page=${data.index + 1}`);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/issues")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const grouped = groupIssuesByWeek(data.issues as IssueSummary[]);

        setWeeks(grouped);

        const params = new URLSearchParams(window.location.search);
        const weekParam = params.get("week");
        if (weekParam) {
          const idx = grouped.findIndex((w) => w.weekStart === weekParam);
          setCurrentWeekIdx(idx !== -1 ? idx : grouped.length - 1);
        } else {
          setCurrentWeekIdx(grouped.length - 1);
        }

        // Gate existing GSAP close animation when ?open= is present
        const closeFrom = sessionStorage.getItem("mag-close-from");
        const hasOpenParam = params.has("open");
        if (closeFrom && !hasOpenParam) {
          sessionStorage.removeItem("mag-close-from");
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const card = document.querySelector(
                `[data-issue-number="${closeFrom}"]`
              ) as HTMLElement | null;
              if (!card) return;
              const to = card.getBoundingClientRect();

              const overlay = document.createElement("div");
              overlay.style.cssText = `
                position: fixed; z-index: 9999;
                background: #111; border: 1px solid #333;
                top: 0; left: 0; width: 100vw; height: 100dvh;
                will-change: transform;
              `;
              document.body.appendChild(overlay);

              import("gsap").then(({ default: gsap }) => {
                gsap.to(overlay, {
                  top: to.top, left: to.left,
                  width: to.width, height: to.height,
                  borderRadius: "8px", opacity: 0.7,
                  duration: 0.4, ease: "power3.inOut",
                  onComplete: () => overlay.remove(),
                });
              });
            });
          });
        }

        // Deep link restoration
        const openIssueParam = params.get("open");
        if (openIssueParam) {
          const num = parseInt(openIssueParam, 10);
          if (!isNaN(num)) {
            const fallback: Rect = {
              top: window.innerHeight / 4,
              left: window.innerWidth / 4,
              width: window.innerWidth / 2,
              height: (window.innerWidth / 2) * 1.4,
            };
            setCoverRect(fallback);

            const article = params.get("article");
            if (article) {
              const artIdx = parseInt(article, 10);
              if (!isNaN(artIdx)) {
                setOpenArticleIndex(artIdx);
                setOpenIssue(num);
                setLevel("article");
                return;
              }
            }
            setOpenIssue(num);
            setLevel("spread");
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Set initial Embla position to current week
  useEffect(() => {
    if (emblaApi && weeks.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      emblaApi.scrollTo(weeks.length - 1);
    }
  }, [emblaApi, weeks.length]);

  // Re-init Embla after week index changes
  useEffect(() => {
    if (emblaApi && initializedRef.current) {
      requestAnimationFrame(() => emblaApi.reInit());
    }
  }, [emblaApi, currentWeekIdx]);

  // Observe Embla selected index to sync currentWeekIdx on swipe
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap();
      if (idx >= 0 && idx < weeks.length && idx !== currentWeekIdx) {
        setCurrentWeekIdx(idx);
      }
    };
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, weeks.length, currentWeekIdx]);

  // Update URL from week state
  useEffect(() => {
    if (weeks.length === 0 || level !== "shelf") return;
    const week = weeks[currentWeekIdx];
    if (!week) return;
    const url = `/issues?week=${week.weekStart}`;
    window.history.replaceState(null, "", url);
  }, [currentWeekIdx, weeks, level]);

  // Popstate listener for back button
  useEffect(() => {
    const onPopState = () => {
      if (level !== "shelf") {
        setLevel("shelf");
        setOpenIssue(null);
        setZooming(false);
        setNavigateTo(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [level]);

  const handleMonthChange = useCallback((monthLabel: string) => {
    const idx = weeks.findIndex((w) => w.monthLabel === monthLabel);
    if (idx !== -1) {
      setCurrentWeekIdx(idx);
      requestAnimationFrame(() => {
        emblaApi?.reInit();
        setTimeout(() => emblaApi?.scrollTo(idx), 50);
      });
    }
  }, [weeks, emblaApi]);

  const handleCoverClick = useCallback((e: React.MouseEvent<HTMLButtonElement>, issueNumber: number) => {
    const now = Date.now();
    if (now - lastTapRef.current < 200) return;
    lastTapRef.current = now;

    const rect = e.currentTarget.getBoundingClientRect();
    setCoverRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
    setOpenIssue(issueNumber);
    setLevel("spread");
    window.history.pushState(null, "", `/issues?open=${issueNumber}`);
  }, [weeks, emblaApi]);

  const renderBody = () => {
    if (loading) {
      return (
        <div className="flex h-full items-center justify-center bg-black">
          <p className="text-zinc-400 text-sm">Loading shelf...</p>
        </div>
      );
    }

    if (error || weeks.length === 0 || !currentWeek) {
      return (
        <div className="flex h-full items-center justify-center bg-black px-4">
          <p className="text-zinc-400 text-sm text-center">
            {error || "Nothing here yet. The first issue is brewing."}
          </p>
        </div>
      );
    }

    const monthOptions = getMonthOptions(weeks);

    return (
      <>
        <div className="px-4 pt-14 pb-3 flex items-center">
          <div className="relative inline-flex items-center gap-1">
            <select
              value={currentWeek.monthLabel}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="appearance-none bg-transparent text-sm text-zinc-400 border border-zinc-800 rounded-md px-3 py-1.5 pr-7 focus:outline-none focus:border-zinc-600 cursor-pointer"
            >
              {monthOptions.map((month) => (
                <option key={month} value={month} className="bg-zinc-900 text-zinc-300">
                  {month}
                </option>
              ))}
            </select>
            <CaretDown size={12} weight="bold" className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        <div className="px-4 pb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            {currentWeek.weekLabel}
          </h2>
        </div>

        {/* Embla carousel — each slide is one week */}
        <div className="flex-1 px-4 pb-4 min-h-0 overflow-hidden" ref={emblaRef}>
          <div className="flex h-full">
            {weeks.map((week, weekIdx) => (
              <div
                key={week.weekStart}
                className="flex-[0_0_100%] min-w-0 h-full"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 h-full auto-rows-min content-start">
                  {week.days.map((day) => (
                    <CoverCard
                      key={day.date}
                      day={day}
                      isFinished={day.issue ? isFinished(day.issue.number) : false}
                      onClick={handleCoverClick}
                    />
                  ))}
                  {/* Ghost placeholder for next day — current week only */}
                  {week.days.some((d) => d.isToday) && weekIdx === weeks.length - 1 && week.days.some((d) => d.issue) && (
                    <div className="relative flex flex-col items-center justify-center w-full rounded-lg border-2 border-dashed border-zinc-700/30 bg-zinc-900/30 aspect-[2/3] opacity-60">
                      <span className="text-xs text-zinc-500/60 uppercase tracking-wider">Coming</span>
                      <span className="text-xs text-zinc-400 mt-0.5">tomorrow</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Week indicator dots — only when there are multiple weeks */}
        {weeks.length > 1 && (
          <div className="px-4 pb-4 flex items-center justify-center gap-1.5">
            {weeks.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentWeekIdx(idx);
                  emblaApi?.scrollTo(idx);
                }}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  idx === currentWeekIdx ? "bg-zinc-400/70" : "bg-zinc-700"
                }`}
                aria-label={`Week ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-black text-zinc-100">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4">
        {resumeHref ? (
          <a
            href={resumeHref}
            className="flex h-10 w-10 items-center justify-center text-zinc-300 hover:text-white transition-colors"
            aria-label="Resume reading"
          >
            <BookmarkSimple size={20} weight="fill" />
          </a>
        ) : (
          <a
            href="/"
            className="flex h-10 w-10 items-center justify-center text-zinc-400 hover:text-zinc-400 transition-colors"
            aria-label="Latest issue"
          >
            <BookmarkSimple size={20} />
          </a>
        )}
        <span className="text-sm font-semibold text-zinc-300 select-none">RSSMag</span>
        <button
          onClick={() => setNavOpen(true)}
          className="text-zinc-300 hover:text-white transition-colors"
          aria-label="Open navigation"
        >
          <DotsThree size={20} />
        </button>
      </header>

      <div className="pointer-events-none fixed top-0 inset-x-0 z-30 h-20 bg-gradient-to-b from-black/90 to-transparent" />

      {renderBody()}

      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}
