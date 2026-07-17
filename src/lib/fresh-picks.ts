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

export function getFreshPicks<T extends { link: string; sourceTitle: string }>(
  items: T[],
  seenSources: string[],
): T[] {
  if (seenSources.length === 0) return [];
  const shown = getShownPicks();
  const unseen = items.filter(
    (item) => !shown.has(item.link) && !seenSources.includes(item.sourceTitle),
  );
  if (unseen.length < 2) return [];
  const shuffled = [...unseen].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(FRESH_PICKS_COUNT, shuffled.length));
}
