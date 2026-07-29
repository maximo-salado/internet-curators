// ---------------------------------------------------------------------------
// Session-scoped dismiss helpers for bookmark & forward navigation bars.
//
// sessionStorage is tab-scoped: opening a new tab re-shows bars (by design).
// Dismissed state is a signature — when the saved bookmark changes (user
// swipes to a new article), the old dismiss expires and the bar re-shows.
// ---------------------------------------------------------------------------

const DISMISSED_BOOKMARK_KEY = "rssmag-dismissed-bookmark";
const DISMISSED_FORWARD_KEY = "rssmag-dismissed-forward";

// ---- Bookmark signature ----

/** A unique identifier for a saved reading position: e.g. "45:6". */
export function bookmarkSignature(data: {
  issueNumber: number;
  index: number;
}): string {
  return `${data.issueNumber}:${data.index}`;
}

// ---- Bookmark dismiss ----

export function setDismissedBookmark(signature: string): void {
  try {
    sessionStorage.setItem(DISMISSED_BOOKMARK_KEY, signature);
  } catch {
    // sessionStorage unavailable — silently ignore
  }
}

export function getDismissedBookmark(): string | null {
  try {
    return sessionStorage.getItem(DISMISSED_BOOKMARK_KEY);
  } catch {
    return null;
  }
}

// ---- Forward bar dismiss ----

export function setDismissedForward(latestNumber: number): void {
  try {
    sessionStorage.setItem(DISMISSED_FORWARD_KEY, String(latestNumber));
  } catch {
    // sessionStorage unavailable — silently ignore
  }
}

export function getDismissedForward(): number | null {
  try {
    const val = sessionStorage.getItem(DISMISSED_FORWARD_KEY);
    return val != null ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}
