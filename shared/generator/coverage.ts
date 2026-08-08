import { ROSCO_LETTERS, type Difficulty, type GameMode } from "../domain/types.js";
import type { ContentEntry } from "../validation/schemas.js";
import { isEligible } from "./eligibility.js";
import type { CoverageReport } from "./types.js";

export function analyzeCoverage(
  entries: ContentEntry[],
  mode: GameMode,
  difficulty: Difficulty,
  maxPlayers = 4,
  distractorCount = 4,
  cooldownGames = 5
): CoverageReport {
  const cells = ROSCO_LETTERS.map((letter) => {
    const candidates = entries.filter(
      (entry) => entry.letter === letter && isEligible(entry, mode, difficulty)
    );
    const startsWith = candidates.filter((entry) => entry.relation === "empieza").length;
    const contains = candidates.length - startsWith;
    const relationCapacity = Math.max(startsWith, contains);
    const supportsPlayers = Math.min(maxPlayers, Math.max(0, relationCapacity - distractorCount));

    return {
      letter,
      candidates: candidates.length,
      startsWith,
      contains,
      supportsPlayers,
      ready: supportsPlayers >= maxPlayers,
      sustainable: relationCapacity >= maxPlayers * (cooldownGames + 1) + distractorCount
    };
  });

  return {
    mode,
    difficulty,
    maxPlayers,
    distractorCount,
    cooldownGames,
    ready: cells.every((cell) => cell.ready),
    cells
  };
}
