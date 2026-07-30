"use client";

import { useState, useEffect } from "react";
import CoverCard from "./CoverCard";
import { groupIssuesByWeek, getMonthOptions, type WeekGroup } from "@/lib/weeks";
import type { IssueSummary } from "@/app/api/issues/route";
import { CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react";

function isFinished(issueNumber: number): boolean {
  try {
    return localStorage.getItem(`rssmag-completed-${issueNumber}`) === "true";
  } catch {
    return false;
  }
}

export default function IssueShelf() {
  const [weeks, setWeeks] = useState<WeekGroup[]>([]);
  const [currentWeekIdx, setCurrentWeekIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/issues")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const grouped = groupIssuesByWeek(data.issues as IssueSummary[]);
        setWeeks(grouped);
        setCurrentWeekIdx(grouped.length - 1);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleMonthChange = (monthLabel: string) => {
    const idx = weeks.findIndex((w) => w.monthLabel === monthLabel);
    if (idx !== -1) setCurrentWeekIdx(idx);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <p className="text-zinc-600 text-sm">Loading shelf...</p>
      </div>
    );
  }

  if (error || weeks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-black px-4">
        <p className="text-zinc-500 text-sm text-center">
          {error || "Nothing here yet. The first issue is brewing."}
        </p>
      </div>
    );
  }

  const currentWeek = weeks[currentWeekIdx];
  const monthOptions = getMonthOptions(weeks);
  const isFirstWeek = currentWeekIdx === 0;
  const isLastWeek = currentWeekIdx === weeks.length - 1;

  const heroIdx = (() => {
    const withImage = currentWeek.days.findIndex((d) => d.issue && d.issue.leadImage);
    if (withImage !== -1) return withImage;
    const withIssue = currentWeek.days.findIndex((d) => d.issue);
    return withIssue !== -1 ? withIssue : 0;
  })();

  return (
    <div className="flex flex-col h-full w-full bg-black text-zinc-100">
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
          <CaretDown size={12} weight="bold" className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        </div>
      </div>

      <div className="px-4 pb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {currentWeek.weekLabel}
        </h2>
      </div>
      {/* Grid — 2 columns, Monday hero spans 2 rows */}
      <div className="flex-1 px-4 pb-4 min-h-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 h-full" style={{ gridTemplateRows: "1fr 1fr 1fr 1fr" }}>
          {currentWeek.days.map((day, idx) => (
            <CoverCard
              key={day.date}
              day={day}
              isHero={idx === heroIdx}
              isFinished={day.issue ? isFinished(day.issue.number) : false}
            />
          ))}
        </div>
      </div>

      <div className="px-4 pb-6 flex items-center justify-between">
        <button
          onClick={() => setCurrentWeekIdx((prev) => Math.max(0, prev - 1))}
          disabled={isFirstWeek}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <CaretLeft size={14} />
          Older
        </button>
        <span className="text-xs text-zinc-600">{currentWeek.monthLabel}</span>
        <button
          onClick={() => setCurrentWeekIdx((prev) => Math.min(weeks.length - 1, prev + 1))}
          disabled={isLastWeek}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          Newer
          <CaretRight size={14} />
        </button>
      </div>
    </div>
  );
}
