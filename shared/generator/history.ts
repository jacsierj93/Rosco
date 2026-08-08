import type { UsageHistory } from "./types.js";

export function recordGameUsage(
  history: UsageHistory,
  selectedEntryIds: readonly string[],
  gameNumber: number
): UsageHistory {
  const next = structuredClone(history);
  for (const entryId of new Set(selectedEntryIds)) {
    const previous = next[entryId];
    next[entryId] = {
      entryId,
      lastGameNumber: gameNumber,
      useCount: (previous?.useCount ?? 0) + 1
    };
  }
  return next;
}

