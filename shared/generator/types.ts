import type { Difficulty, GameMode, PlayerState, RoscoLetter } from "../domain/types.js";
import type { ContentEntry, GameConfig } from "../validation/schemas.js";

export interface UsageRecord {
  entryId: string;
  lastGameNumber: number;
  useCount: number;
}

export type UsageHistory = Record<string, UsageRecord>;

export interface GenerateRoscosInput {
  config: GameConfig;
  entries: ContentEntry[];
  history: UsageHistory;
  gameNumber: number;
  seed: string;
  letters?: readonly RoscoLetter[];
  cooldownGames?: number;
  distractorCount?: number;
}

export interface GeneratedRoscos {
  players: PlayerState[];
  seed: string;
  selectedEntryIds: string[];
  regionalSelected: number;
  regionalTarget: number;
}

export interface CoverageCell {
  letter: RoscoLetter;
  candidates: number;
  startsWith: number;
  contains: number;
  supportsPlayers: number;
  ready: boolean;
  sustainable: boolean;
}

export interface CoverageReport {
  mode: GameMode;
  difficulty: Difficulty;
  maxPlayers: number;
  distractorCount: number;
  cooldownGames: number;
  ready: boolean;
  cells: CoverageCell[];
}
