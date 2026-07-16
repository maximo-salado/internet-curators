const SEEN_SOURCES_KEY = "ic:seenSources";

export function getSeenSources(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_SOURCES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveSeenSources(sourceTitles: string[]): void {
  const unique = [...new Set(sourceTitles)];
  localStorage.setItem(SEEN_SOURCES_KEY, JSON.stringify(unique));
}

export function boostUnseen<T extends { sourceTitle: string }>(
  items: T[],
  seenSources: string[]
): T[] {
  if (seenSources.length === 0) return items;

  const seenSet = new Set(seenSources);
  const unseen: T[] = [];
  const seen: T[] = [];

  for (const item of items) {
    if (seenSet.has(item.sourceTitle)) {
      seen.push(item);
    } else {
      unseen.push(item);
    }
  }

  return [...unseen, ...seen];
}
