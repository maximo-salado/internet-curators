"use client";

import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import CoverCard from "./CoverCard";
import { weekRangeFor } from "@/lib/weeks";

interface IssueSummary {
  number: number;
  date: string;
  count: number;
  leadImage: string | null;
}

function isFinished(issueNumber: number): boolean {
  try {
    return localStorage.getItem(`rssmag-completed-${issueNumber}`) === "true";
  } catch {
    return false;
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Get the date range covering roughly 3 months back from today,
 * so the shelf always shows ~90 days of issues.
 */
function shelfDateRange(): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = today.toISOString().slice(0, 10);
  const from = new Date(today);
  from.setDate(from.getDate() - 90);
  return { from: from.toISOString().slice(0, 10), to };
}

export default function IssueShelf() {
  const [issues, setIssues] = useState<
    (IssueSummary & { isToday: boolean; isFinished: boolean })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [weekLabel, setWeekLabel] = useState("");

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "end", // newest on the right
    containScroll: "trimSnaps",
    dragFree: false,
    slidesToScroll: 1,
  });

  const updateWeekLabel = useCallback(() => {
    if (!emblaApi || issues.length === 0) return;
    const idx = emblaApi.selectedScrollSnap();
    const issue = issues[idx];
    if (issue) {
      const range = weekRangeFor(new Date(issue.date + "T00:00:00"));
      setWeekLabel(range.label);
    }
  }, [emblaApi, issues]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", updateWeekLabel);
    updateWeekLabel();
    return () => {
      emblaApi.off("select", updateWeekLabel);
    };
  }, [emblaApi, updateWeekLabel]);

  useEffect(() => {
    const { from, to } = shelfDateRange();
    fetch(`/api/issues?from=${from}&to=${to}`)
      .then((res) => res.json())
      .then((data) => {
        const today = new Date().toISOString().slice(0, 10);
        const mapped = (data.issues ?? []).map((i: IssueSummary) => ({
          ...i,
          isToday: i.date === today,
          isFinished: isFinished(i.number),
        }));
        setIssues(mapped);
      })
      .catch(() => setIssues([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <p className="text-zinc-600 text-sm">Loading shelf...</p>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-black px-4">
        <p className="text-zinc-500 text-sm text-center max-w-xs">
          Nothing here yet. The first issue is brewing.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-black text-zinc-100">
      {/* Week label */}
      <div className="px-4 pt-16 pb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {weekLabel}
        </h2>
      </div>

      {/* Carousel */}
      <div className="flex-1 flex items-center">
        <div className="overflow-hidden w-full" ref={emblaRef}>
          <div className="flex gap-3 pl-4">
            {issues.map((entry) => (
              <div
                key={entry.number}
                className="flex-[0_0_150px] min-w-0"
              >
                <CoverCard
                  number={entry.number}
                  date={formatDate(entry.date)}
                  count={entry.count}
                  leadImage={entry.leadImage}
                  isToday={entry.isToday}
                  isFinished={entry.isFinished}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
