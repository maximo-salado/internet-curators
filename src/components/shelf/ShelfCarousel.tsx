"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useEmblaCarousel from "embla-carousel-react";
import { Calendar, List, X } from "@phosphor-icons/react";
import lottie from "lottie-web";
import type { IssueSummary } from "@/app/api/issues/route";
import Magazine from "./Magazine";
import NavDrawer from "@/components/reader/NavDrawer";
import bookmarkAnim from "@/lottie/bookmark.json";

type ShelfItem =
  | { kind: "issue"; issue: IssueSummary }
  | { kind: "placeholder"; label: string }
  | { kind: "prevWeek"; label: string };

export default function ShelfCarousel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialIssue = searchParams.get("issue");

  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openIssueNumber, setOpenIssueNumber] = useState<number | null>(
    initialIssue ? Number(initialIssue) : null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  // Bookmark — read saved position from localStorage (existing system)
  const resumeData = useMemo(() => {
    try {
      const raw = localStorage.getItem("rssmag-resume");
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && typeof data.issueNumber === "number" && typeof data.index === "number") {
        return {
          issueNumber: data.issueNumber,
          page: data.index + 1,
          href: `/issue/${data.issueNumber}?page=${data.index + 1}`,
        };
      }
    } catch {}
    return null;
  }, []);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    containScroll: false,
    skipSnaps: false,
    dragThreshold: 15,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const bookmarkRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/issues")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setIssues(data.issues as IssueSummary[]);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const months = useMemo(() => {
    const seen = new Set<string>();
    return issues
      .map((i) => {
        const d = new Date(i.date + "T00:00:00");
        return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      })
      .filter((m) => {
        if (seen.has(m)) return false;
        seen.add(m);
        return true;
      });
  }, [issues]);

  // Display order: prev-week → oldest → newest → tomorrow
  const shelfItems = useMemo<ShelfItem[]>(() => {
    if (issues.length === 0) return [];
    const issueItems: ShelfItem[] = [...issues].reverse().map((issue) => ({
      kind: "issue" as const,
      issue,
    }));

    const prevWeek: ShelfItem[] = (() => {
      if (issueItems.length === 0) return [];
      const lastIssue = (issueItems[issueItems.length - 1] as { kind: "issue"; issue: IssueSummary }).issue;
      const newestDate = new Date(lastIssue.date + "T00:00:00");
      const dayOfWeek = newestDate.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const thisWeekStart = new Date(newestDate);
      thisWeekStart.setDate(newestDate.getDate() + mondayOffset);
      thisWeekStart.setHours(0, 0, 0, 0);

      const firstPrevIdx = issueItems.findIndex((item) => {
        if (item.kind !== "issue") return false;
        const d = new Date(item.issue.date + "T00:00:00");
        return d < thisWeekStart;
      });

      if (firstPrevIdx === -1) return [];
      return [{ kind: "prevWeek" as const, label: "Previous week" }];
    })();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const label = tomorrow.toLocaleDateString("en-US", { weekday: "long" }) + "'s issue — midnight";
    const nextPlaceholder: ShelfItem = { kind: "placeholder", label };

    return [...prevWeek, ...issueItems, nextPlaceholder];
  }, [issues, months]);

  useEffect(() => {
    if (!emblaApi || shelfItems.length === 0 || initializedRef.current) return;
    initializedRef.current = true;
    emblaApi.scrollTo(shelfItems.length - 2);
  }, [emblaApi, shelfItems.length]);

  useEffect(() => {
    if (!emblaApi || !containerRef.current) return;
    const observer = new ResizeObserver(() => { emblaApi.reInit(); });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [emblaApi]);

  const updateTilt = useCallback(() => {
    if (!containerRef.current) return;
    const wrappers = containerRef.current.querySelectorAll(".embla__tilt") as NodeListOf<HTMLElement>;
    if (wrappers.length === 0) return;
    const viewportCenter = window.innerWidth / 2;
    for (const wrapper of wrappers) {
      const rect = wrapper.getBoundingClientRect();
      const slideCenter = rect.left + rect.width / 2;
      const offset = (slideCenter - viewportCenter) / (viewportCenter + 200);
      const clamped = Math.max(-1, Math.min(1, offset));
      const rotateY = clamped * -25;
      const scale = 1 - Math.abs(clamped) * 0.18;
      wrapper.style.transform = `rotateY(${rotateY}deg) scale(${scale})`;
    }
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    const onScroll = () => requestAnimationFrame(updateTilt);
    emblaApi.on("scroll", onScroll);
    emblaApi.on("reInit", updateTilt);
    requestAnimationFrame(updateTilt);
    return () => {
      emblaApi.off("scroll", onScroll);
      emblaApi.off("reInit", updateTilt);
    };
  }, [emblaApi, updateTilt, shelfItems.length]);

  useEffect(() => {
    window.addEventListener("resize", updateTilt);
    return () => window.removeEventListener("resize", updateTilt);
  }, [updateTilt]);

  const scrollToPrevWeek = useCallback(() => {
    if (shelfItems.length > 1) emblaApi?.scrollTo(1);
  }, [shelfItems.length, emblaApi]);

  const handleMonthChange = useCallback(
    (monthLabel: string) => {
      if (!emblaApi) return;
      const idx = shelfItems.findIndex((item) => {
        if (item.kind !== "issue") return false;
        const d = new Date(item.issue.date + "T00:00:00");
        const label = d.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
        return label === monthLabel;
      });
      if (idx !== -1) emblaApi.scrollTo(idx);
      setTimePickerOpen(false);
    },
    [emblaApi, shelfItems],
  );

  const handleOpen = useCallback((issueNumber: number) => {
    setOpenIssueNumber(issueNumber);
    router.push(`/issues?issue=${issueNumber}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    const issueParam = searchParams.get("issue");
    const num = issueParam ? Number(issueParam) : null;
    if (num !== openIssueNumber) setOpenIssueNumber(num);
  }, [searchParams]);

  // Bookmark lottie animation.
  // Depends on [loading, resumeData]: on first mount `loading` is true so the
  // CTA (and its ref) isn't rendered yet — the effect must re-run once loading
  // finishes and the bookmark container actually exists.
  useEffect(() => {
    if (loading || !resumeData || !bookmarkRef.current) return;
    const anim = lottie.loadAnimation({
      container: bookmarkRef.current,
      animationData: bookmarkAnim,
      renderer: "svg",
      loop: true,
      autoplay: true,
    });
    return () => anim.destroy();
  }, [loading, resumeData]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <p className="text-zinc-400 text-base">Loading shelf...</p>
      </div>
    );
  }

  if (error || issues.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-black px-4">
        <p className="text-zinc-400 text-base text-center">
          {error || "Nothing here yet. The first issue is brewing."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-black text-zinc-100">
      {/* Header: [hamburger] [centered logo] [calendar icon] */}
      <header className="fixed top-0 inset-x-0 z-40 h-16 flex items-center px-4">
        <div className="flex-1 flex justify-start">
          <button onClick={() => setMenuOpen(!menuOpen)} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors" aria-label="Menu">
            <List size={22} weight="light" />
          </button>
        </div>

        <div className="flex-1 flex justify-center">
          <span className="font-serif text-2xl font-bold tracking-[0.15em] text-zinc-200 select-none">
            RSSMag
          </span>
        </div>

        <div className="flex-1 flex justify-end items-center">
          <button
            onClick={() => setTimePickerOpen(!timePickerOpen)}
            className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            aria-label="Time picker"
          >
            <Calendar size={20} weight="light" />
          </button>
        </div>
      </header>

      <div className="pointer-events-none fixed top-0 inset-x-0 z-30 h-24 bg-gradient-to-b from-black/95 to-transparent" />
      <div className="h-16 shrink-0" />

      <div className="flex-1 min-h-0 flex items-center pb-16" style={{ perspective: "800px" }} ref={containerRef}>
        <div className="w-full overflow-hidden" ref={emblaRef}>
          <div className="flex" style={{ transformStyle: "preserve-3d" }}>
            {shelfItems.map((item) => {
              if (item.kind === "prevWeek") {
                return (
                  <div key="prev-week" className="flex-[0_0_70%] sm:flex-[0_0_48%] md:flex-[0_0_60%] lg:flex-[0_0_26%] xl:flex-[0_0_20%] min-w-0 px-1.5 first:pl-4 last:pr-4 embla__slide">
                    <div className="embla__tilt w-full h-full" style={{ transformStyle: "preserve-3d" }}>
                      <button
                        onClick={scrollToPrevWeek}
                        className="relative flex flex-col items-center justify-center w-full aspect-[2/3] rounded-lg border border-dashed border-zinc-500/40 bg-zinc-800/80 hover:border-zinc-400/60 hover:bg-zinc-800 active:scale-[0.98] transition-all cursor-pointer"
                        style={{ transformStyle: "preserve-3d", boxShadow: "0 0 30px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)" }}
                      >
                        <div className="flex flex-col items-center gap-2 px-4 text-center">
                          <span className="text-zinc-300 text-xs uppercase tracking-widest">← Jump to</span>
                          <span className="text-zinc-200 text-sm leading-tight">{item.label}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                );
              }

              if (item.kind === "placeholder") {
                return (
                  <div key="tomorrow" className="flex-[0_0_70%] sm:flex-[0_0_48%] md:flex-[0_0_60%] lg:flex-[0_0_26%] xl:flex-[0_0_20%] min-w-0 px-1.5 first:pl-4 last:pr-4 embla__slide">
                    <div className="embla__tilt w-full h-full" style={{ transformStyle: "preserve-3d" }}>
                      <div
                        className="relative flex flex-col items-center justify-center w-full aspect-[2/3] rounded-lg border border-dashed border-zinc-500/40 bg-zinc-800/80"
                        style={{ transformStyle: "preserve-3d", boxShadow: "0 0 30px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)" }}
                      >
                        <div className="flex flex-col items-center gap-2 px-4 text-center">
                          <span className="text-zinc-300 text-xs uppercase tracking-widest">Next issue</span>
                          <span className="text-zinc-200 text-sm leading-tight">{item.label}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              const issue = item.issue;
              return (
                <Magazine
                  key={issue.number}
                  issue={issue}
                  index={issue.number - 1}
                  isOpen={openIssueNumber === issue.number}
                  onRequestOpen={() => handleOpen(issue.number)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Bookmark CTA — bottom of shelf, only visible when saved position exists */}
      {resumeData && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center pointer-events-none">
          <a
            href={resumeData.href}
            className="pointer-events-auto inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-800 text-amber-400 rounded-full text-base font-medium hover:bg-zinc-700 hover:text-amber-300 transition-colors shadow-lg shadow-black/40 border border-zinc-700/50"
          >
            <div ref={bookmarkRef} style={{ width: 16, height: 16 }} />
            <span>Continue where you left →</span>
          </a>
        </div>
      )}

      {/* NavDrawer (hamburger menu) — only mount when open to avoid backdrop stacking conflicts */}
      {menuOpen && <NavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />}

      {/* Time picker bottom sheet */}
      {timePickerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setTimePickerOpen(false)}
          />
          {/* Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-white/10 bg-zinc-800/95 backdrop-blur-xl max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h3 className="text-base font-semibold text-zinc-200">
                Jump to month
              </h3>
              <button
                onClick={() => setTimePickerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                aria-label="Close time picker"
              >
                <X size={16} weight="bold" />
              </button>
            </div>
            <div className="px-2 pb-4">
              {months.map((month) => (
                <button
                  key={month}
                  onClick={() => handleMonthChange(month)}
                  className="w-full px-4 py-3 text-left text-sm text-zinc-300 hover:bg-zinc-700/50 hover:text-white rounded-lg transition-colors"
                >
                  {month}
                </button>
              ))}
            </div>
          </div>
          {/* Safe-area padding for mobile */}
          <div className="fixed inset-x-0 bottom-0 z-50 h-6 bg-zinc-800/95 backdrop-blur-xl pointer-events-none" />
        </>
      )}
    </div>
  );
}
