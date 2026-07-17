"use client";

import { useState, useEffect } from "react";

interface ReadingStatsData {
  weekStart: string;
  count: number;
  sources: string[];
}

function getMondayOfWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

function loadStats(): ReadingStatsData {
  const raw = localStorage.getItem("ic:reading-stats");
  if (!raw) return { weekStart: getMondayOfWeek(), count: 0, sources: [] };
  try {
    const data: ReadingStatsData = JSON.parse(raw);
    if (data.weekStart === getMondayOfWeek()) return data;
    return { weekStart: getMondayOfWeek(), count: 0, sources: [] };
  } catch {
    return { weekStart: getMondayOfWeek(), count: 0, sources: [] };
  }
}

function saveStats(stats: ReadingStatsData) {
  localStorage.setItem("ic:reading-stats", JSON.stringify(stats));
}

interface ReadingStatsProps {
  loadedCount: number;
}

export function ReadingStats({ loadedCount }: ReadingStatsProps) {
  const [stats, setStats] = useState<ReadingStatsData | null>(() => loadStats());

  useEffect(() => {
    function onArticleRead(e: Event) {
      const detail = (e as CustomEvent<{ link: string; sourceTitle: string }>).detail;
      if (!detail) return;
      setStats((prev) => {
        const current = prev ?? loadStats();
        if (current.weekStart !== getMondayOfWeek()) {
          const fresh = { weekStart: getMondayOfWeek(), count: 1, sources: [detail.sourceTitle] };
          saveStats(fresh);
          return fresh;
        }
        const sources = current.sources.includes(detail.sourceTitle)
          ? current.sources
          : [...current.sources, detail.sourceTitle];
        const next = { ...current, count: current.count + 1, sources };
        saveStats(next);
        return next;
      });
    }

    window.addEventListener("ic:article-read", onArticleRead);
    return () => window.removeEventListener("ic:article-read", onArticleRead);
  }, []);

  if (!stats || loadedCount < 60 || stats.count === 0) return null;

  return (
    <p className="text-center text-xs text-zinc-600 py-2">
      You have read {stats.count} article{stats.count !== 1 ? "s" : ""} this week across{" "}
      {stats.sources.length} source{stats.sources.length !== 1 ? "s" : ""}
    </p>
  );
}
