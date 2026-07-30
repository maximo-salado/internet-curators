import type { IssueSummary } from "@/app/api/issues/route";

export interface DaySlot {
  date: string;
  label: string;
  issue: IssueSummary | null;
  isToday: boolean;
  isFuture: boolean;
}

export interface WeekGroup {
  weekStart: string;
  days: DaySlot[];
  monthLabel: string;
  weekLabel: string;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function groupIssuesByWeek(issues: IssueSummary[]): WeekGroup[] {
  if (issues.length === 0) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = fmtDate(today);

  const issueMap = new Map<string, IssueSummary>();
  for (const issue of issues) issueMap.set(issue.date, issue);

  const dates = issues.map((i) => i.date).sort();
  const earliest = dates[0];
  const latest = dates[dates.length - 1];

  const startMonday = mondayOf(new Date(earliest + "T00:00:00"));
  const currentMonday = mondayOf(today);

  const weeks: WeekGroup[] = [];
  let mon = new Date(currentMonday);

  while (mon >= startMonday) {
    const days: DaySlot[] = [];

    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(mon, i);
      const dateStr = fmtDate(dayDate);
      const issue = issueMap.get(dateStr) ?? null;
      const isFuture = dateStr > todayStr;
      const isToday = dateStr === todayStr;

      days.push({ date: dateStr, label: DAY_LABELS[i], issue, isToday, isFuture });
    }

    const weekEnd = addDays(mon, 6);
    weeks.push({
      weekStart: fmtDate(mon),
      days,
      monthLabel: mon.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      weekLabel: `${mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    });

    mon.setDate(mon.getDate() - 7);
  }

  return weeks.reverse();
}

export function getMonthOptions(weeks: WeekGroup[]): string[] {
  const seen = new Set<string>();
  return weeks
    .map((w) => w.monthLabel)
    .filter((m) => {
      if (seen.has(m)) return false;
      seen.add(m);
      return true;
    });
}
