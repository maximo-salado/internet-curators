"use client";

import { useState, useEffect, useCallback } from "react";
import SwipeStack from "@/components/reader/SwipeStack";
import { composePages } from "@/lib/compose-pages";
import type { Page, FeedItem } from "@/lib/compose-pages";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RESUME_KEY = "rssmag-resume";

interface ResumeData {
  issueNumber: number;
  index: number;
}

interface IssueResponse {
  number: number;
  date: string;
  count: number;
  origin: string;
  isToday: boolean;
  published: boolean;
}

interface FeedResponse {
  issue: IssueResponse | null;
  items: FeedItem[];
}

type Status = "loading" | "empty" | "error" | "ready";

// ---------------------------------------------------------------------------
// localStorage helpers (pure, outside component)
// ---------------------------------------------------------------------------

function loadResumeData(): ResumeData | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.issueNumber === "number" &&
      typeof parsed.index === "number"
    ) {
      return parsed as ResumeData;
    }
  } catch {
    // corrupted data — ignore
  }
  return null;
}

function saveResumeData(data: ResumeData): void {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded or unavailable — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IssueReader({
  issueNumber: propIssueNumber,
}: {
  issueNumber?: number | string;
}) {
  const [pages, setPages] = useState<Page[]>([]);
  const [startIndex, setStartIndex] = useState(0);
  const [issueNumber, setIssueNumber] = useState<number | null>(null);
  const [issueDate, setIssueDate] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  // ---- Fetch & compose on mount ----
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const url =
          propIssueNumber != null
            ? `/api/feed?issue=${propIssueNumber}`
            : "/api/feed";
        const res = await fetch(url);
        if (!res.ok) {
          if (!cancelled) {
            setStatus("error");
            setErrorMessage(`Server returned ${res.status}`);
          }
          return;
        }

        const data: FeedResponse = await res.json();

        if (cancelled) return;

        if (!data.issue) {
          setStatus("empty");
          return;
        }

        const composedPages = composePages(data.issue, data.items);

        // Resolve resume index — only for today's issue (no explicit issueNumber)
        let resumeIndex = 0;
        if (propIssueNumber == null) {
          const saved = loadResumeData();
          if (saved && saved.issueNumber === data.issue.number) {
            resumeIndex = saved.index;
          }
        }

        setPages(composedPages);
        setStartIndex(resumeIndex);
        setIssueNumber(data.issue.number);
        setIssueDate(data.issue.date);
        setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(
            err instanceof Error ? err.message : "Unknown error",
          );
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Save progress on index change (today's issue only) ----
  const handleIndexChange = useCallback(
    (index: number) => {
      if (issueNumber !== null && propIssueNumber == null) {
        saveResumeData({ issueNumber, index });
      }
    },
    [issueNumber, propIssueNumber],
  );

  // ---- Render: loading ----
  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-lg text-zinc-500">Loading...</p>
      </div>
    );
  }

  // ---- Render: empty (no issue today / issue not found) ----
  if (status === "empty") {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <p className="max-w-md text-center text-lg text-zinc-400">
          {propIssueNumber != null
            ? "Issue not found."
            : "Today&apos;s issue is still being assembled. Check back later."}
        </p>
      </div>
    );
  }

  // ---- Render: error ----
  if (status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4">
        <p className="text-lg text-zinc-400">Something went wrong.</p>
        {errorMessage && (
          <p className="text-sm text-zinc-500">{errorMessage}</p>
        )}
      </div>
    );
  }

  // ---- Render: ready ----
  return (
    <SwipeStack
      pages={pages}
      startIndex={startIndex}
      onIndexChange={handleIndexChange}
      issueNumber={issueNumber ?? 0}
      issueDate={issueDate}
    />
  );
}
