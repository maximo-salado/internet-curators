/**
 * Get the Monday of the week containing the given date.
 * Weeks start on Monday.
 */
export function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format a Date to YYYY-MM-DD.
 */
export function fmtDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Given a date, return the start (Monday) and end (Sunday) of its week,
 * plus a natural-language label.
 */
export function weekRangeFor(
  date: Date
): { from: string; to: string; label: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monday = mondayOf(date);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const thisMonday = mondayOf(today);

  const diffWeeks = Math.round(
    (thisMonday.getTime() - monday.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  let label: string;
  if (diffWeeks === 0) {
    label = "This week";
  } else if (diffWeeks === 1) {
    label = "Last week";
  } else {
    const month = monday.toLocaleDateString("en-US", { month: "short" });
    const day = monday.getDate();
    label = `Week of ${month} ${day}`;
  }

  return {
    from: fmtDate(monday),
    to: fmtDate(sunday),
    label,
  };
}
