"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import SwipeStack from "@/components/reader/SwipeStack";
import BottomBar from "@/components/reader/BottomBar";
import { composePages } from "@/lib/compose-pages";
import type { Page, FeedItem } from "@/lib/compose-pages";
import {
  bookmarkSignature,
  setDismissedBookmark,
  getDismissedBookmark,
  setDismissedForward,
  getDismissedForward,
} from "@/lib/reader-bookmark";

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
  leadImage?: string;
}

interface FeedResponse {
  issue: IssueResponse | null;
  items: FeedItem[];
  latestNumber: number;
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

  // ---- Bottom bar state ----
  const [showForwardBar, setShowForwardBar] = useState(false);
  const [forwardLatest, setForwardLatest] = useState(0);
  const [showBookmarkBar, setShowBookmarkBar] = useState(false);
  const [bookmarkResume, setBookmarkResume] = useState<ResumeData | null>(null);

  // Refs for the poll handler (avoids stale closures in event listeners)
  const issueNumberRef = useRef<number | null>(null);
  issueNumberRef.current = issueNumber;
  const showForwardBarRef = useRef(false);
  showForwardBarRef.current = showForwardBar;

  const lastPollRef = useRef(0);       // throttle timestamp
  const pollingRef = useRef(false);    // in-flight guard

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

        // Resolve resume index — URL param takes priority, then localStorage
        let resumeIndex = 0;

        const pageParam = new URL(
          window.location.href,
        ).searchParams.get("page");
        const hasPageParam = pageParam != null;

        if (pageParam != null) {
          const parsed = parseInt(pageParam, 10);
          if (!isNaN(parsed) && parsed > 0) {
            resumeIndex = parsed - 1; // 1-indexed → 0-indexed
          }
        } else if (propIssueNumber == null) {
          const saved = loadResumeData();
          if (saved && saved.issueNumber === data.issue.number) {
            resumeIndex = saved.index;
          }
        }

        // ---- Bottom bar logic ----
        // Forward bar: newer issue exists, not dismissed
        const showForward =
          data.issue != null &&
          data.latestNumber > data.issue.number &&
          getDismissedForward() !== data.latestNumber;

        setForwardLatest(data.latestNumber);
        setShowForwardBar(showForward);

        // Bookmark bar: only on root, no ?page=, saved resume from different
        // issue, and not dismissed. Forward bar suppresses bookmark bar.
        let showBookmark = false;
        let bkResume: ResumeData | null = null;

        if (!showForward && propIssueNumber == null && !hasPageParam) {
          const saved = loadResumeData();
          if (saved && saved.issueNumber !== data.issue.number) {
            const sig = bookmarkSignature(saved);
            if (sig !== getDismissedBookmark()) {
              showBookmark = true;
              bkResume = saved;
            }
          }
        }
        setShowBookmarkBar(showBookmark);
        setBookmarkResume(bkResume);

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

  // ---- Save progress on index change (article pages only) ----
  const handleIndexChange = useCallback(
    (index: number) => {
      if (
        issueNumber !== null &&
        pages[index]?.type === "article"
      ) {
        saveResumeData({ issueNumber, index });
      }
    },
    [issueNumber, pages],
  );

  // ---- Midnight-drop poll: detect new issue on focus/visibility ----
  const POLL_THROTTLE_MS = 60_000;

  const pollLatest = useCallback(async () => {
    // Only poll when the bar is not already showing and we have a loaded issue.
    if (showForwardBarRef.current) return;
    const current = issueNumberRef.current;
    if (current == null) return;
    if (pollingRef.current) return;

    const now = Date.now();
    if (now - lastPollRef.current < POLL_THROTTLE_MS) return;
    lastPollRef.current = now;
    pollingRef.current = true;

    try {
      const res = await fetch("/api/feed?latest=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const latest = data.latestNumber;
      if (
        typeof latest === "number" &&
        latest > current &&
        getDismissedForward() !== latest
      ) {
        setForwardLatest(latest);
        setShowForwardBar(true);
        setShowBookmarkBar(false); // forward bar suppresses the bookmark bar
      }
    } catch {
      // network error — ignore, try again on next focus
    } finally {
      pollingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") pollLatest();
    };
    const onFocus = () => pollLatest();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus); // bfcache restore (mobile Safari)
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
    };
  }, [pollLatest]);

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
        <p className="max-w-md text-center text-base text-zinc-400">
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
        <p className="text-base text-zinc-400">Something went wrong.</p>
        {errorMessage && (
          <p className="text-sm text-zinc-500">{errorMessage}</p>
        )}
      </div>
    );
  }

  // ---- Render: ready ----
  return (
    <>
      {/* Forward bar — "newer issue available" */}
      {showForwardBar && (
        <BottomBar
          label={`Issue #${forwardLatest} is out →`}
          onTap={() => {
            window.location.href = "/";
          }}
          onDismiss={() => {
            setDismissedForward(forwardLatest);
            setShowForwardBar(false);
          }}
        />
      )}

      {/* Bookmark bar — "resume where you left off" (only if forward bar not shown) */}
      {showBookmarkBar && bookmarkResume && (
        <BottomBar
          label={`You were at Issue #${bookmarkResume.issueNumber}, page ${bookmarkResume.index + 1}`}
          onTap={() => {
            window.location.href = `/issue/${bookmarkResume.issueNumber}?page=${bookmarkResume.index + 1}`;
          }}
          onDismiss={() => {
            setDismissedBookmark(bookmarkSignature(bookmarkResume));
            setShowBookmarkBar(false);
          }}
        />
      )}

      <SwipeStack
        pages={pages}
        startIndex={startIndex}
        onIndexChange={handleIndexChange}
        issueNumber={issueNumber ?? 0}
        issueDate={issueDate}
        bottomOffset={showForwardBar || showBookmarkBar}
      />
    </>
  );
}
