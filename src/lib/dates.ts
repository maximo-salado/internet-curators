/**
 * Shared date utilities for RSSMag.
 * All issue dates use EST (UTC-5) so the daily cycle aligns with
 * eastern US time — snapshot fires at midnight EST, not UTC.
 */

/** Returns today's date in EST as "YYYY-MM-DD" */
export function estDateString(date: Date = new Date()): string {
  // EST = UTC-5, so shift back 5 hours before extracting the date
  const est = new Date(date.getTime() - 5 * 60 * 60 * 1000);
  return est.toISOString().split("T")[0];
}
