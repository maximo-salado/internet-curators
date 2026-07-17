const PICKS_SHOWN_KEY = "ic:fresh-picks-shown";
const FRESH_PICKS_COUNT = 4;

function getShownPicks(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(PICKS_SHOWN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function saveShownPicks(links: string[]): void {
  const shown = getShownPicks();
  for (const link of links) shown.add(link);
  sessionStorage.setItem(PICKS_SHOWN_KEY, JSON.stringify([...shown]));
}

export function getFreshPicks<T extends { link: string }>(items: T[]): T[] {
  const shown = getShownPicks();
  const fresh = items.filter((item) => !shown.has(item.link));
  if (fresh.length < 2) return [];
  const shuffled = [...fresh].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(FRESH_PICKS_COUNT, shuffled.length));
}
