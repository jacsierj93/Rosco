import type { Difficulty, GameMode } from "../domain/types.js";
import type { ContentEntry } from "../validation/schemas.js";

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  infantil: 1,
  facil: 1,
  intermedio: 2,
  avanzado: 3
};

export function clueFor(entry: ContentEntry, difficulty: Difficulty): string | undefined {
  return entry.clues[difficulty];
}

export function isEligible(entry: ContentEntry, mode: GameMode, difficulty: Difficulty): boolean {
  return (
    entry.modes.includes(mode) &&
    entry.wordDifficulty <= DIFFICULTY_RANK[difficulty] &&
    clueFor(entry, difficulty) !== undefined
  );
}

export function isRegional(entry: ContentEntry): boolean {
  return entry.categories.includes("lunfardo") || entry.categories.includes("argentinismo");
}
