const FRESH_PICKS_MIN = 3;
const FRESH_PICKS_MAX = 5;

export function getFreshPicks<T extends { sourceTitle: string }>(
  items: T[],
  seenSources: string[],
): T[] {
  if (seenSources.length === 0) return [];

  const seenSet = new Set(seenSources);
  const unseen = items.filter((item) => !seenSet.has(item.sourceTitle));

  if (unseen.length === 0) return [];

  const shuffled = [...unseen].sort(() => Math.random() - 0.5);
  const count = Math.min(FRESH_PICKS_MAX, Math.max(FRESH_PICKS_MIN, shuffled.length));

  return shuffled.slice(0, count);
}
