import type { GameState } from "../../../shared/domain/types.js";
import type { UsageHistory } from "../../../shared/generator/types.js";
import type { GameConfig } from "../../../shared/validation/schemas.js";

const DISPLAY_SESSION_KEY = "rosco.displayCredential.v1";
const ACTIVE_GAME_KEY = "rosco.activeGame.v1";
const HISTORY_KEY = "rosco.history.v1";
const CONTENT_FEEDBACK_KEY = "rosco.contentFeedback.v1";

export interface ContentFeedback {
  questionId: string;
  answer: string;
  clue: string;
  mode: GameState["mode"];
  difficulty: GameState["difficulty"];
  reason: "word_difficult" | "clue_problem";
  source: { name: string; url: string };
  reportedAt: string;
}

export interface DisplaySession {
  roomId: string;
  code: string;
  controlToken: string;
  recoveryCredential: string;
}

export function saveDisplaySession(session: DisplaySession): void {
  localStorage.setItem(DISPLAY_SESSION_KEY, JSON.stringify(session));
}

export function loadDisplaySession(): DisplaySession | null {
  const stored = localStorage.getItem(DISPLAY_SESSION_KEY);
  if (!stored) return null;
  try {
    const value = JSON.parse(stored) as Partial<DisplaySession>;
    if (
      typeof value.roomId !== "string" ||
      typeof value.code !== "string" ||
      typeof value.controlToken !== "string" ||
      typeof value.recoveryCredential !== "string"
    ) return null;
    return value as DisplaySession;
  } catch {
    return null;
  }
}

export function clearDisplaySession(): void {
  localStorage.removeItem(DISPLAY_SESSION_KEY);
}

export interface PersistedGame {
  game: GameState;
  config: GameConfig;
  gameNumber: number;
  pendingSelectedEntryIds?: string[];
}

export function saveActiveGame(value: PersistedGame): void {
  localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(value));
}

export function loadActiveGame(): PersistedGame | null {
  const stored = localStorage.getItem(ACTIVE_GAME_KEY);
  if (!stored) return null;
  try {
    const value = JSON.parse(stored) as PersistedGame;
    if (!value?.game?.id || !value?.config?.players || typeof value.gameNumber !== "number") return null;
    return value;
  } catch {
    return null;
  }
}

export function clearActiveGame(): void {
  localStorage.removeItem(ACTIVE_GAME_KEY);
}

export function saveHistory(history: UsageHistory): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function loadHistory(): UsageHistory {
  const stored = localStorage.getItem(HISTORY_KEY);
  if (!stored) return {};
  try {
    const value = JSON.parse(stored) as unknown;
    return typeof value === "object" && value !== null ? value as UsageHistory : {};
  } catch {
    return {};
  }
}

export function saveContentFeedback(report: ContentFeedback): void {
  const current = loadContentFeedback();
  current.push(report);
  localStorage.setItem(CONTENT_FEEDBACK_KEY, JSON.stringify(current));
}

export function loadContentFeedback(): ContentFeedback[] {
  const stored = localStorage.getItem(CONTENT_FEEDBACK_KEY);
  if (!stored) return [];
  try {
    const value = JSON.parse(stored) as unknown;
    return Array.isArray(value) ? value as ContentFeedback[] : [];
  } catch {
    return [];
  }
}

export function exportHistoryFile(history: UsageHistory): void {
  const blob = new Blob([JSON.stringify({ version: 1, history, contentFeedback: loadContentFeedback() }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `rosco-historial-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importHistoryFile(file: File): Promise<UsageHistory> {
  const parsed = JSON.parse(await file.text()) as { version?: unknown; history?: unknown };
  if (parsed.version !== 1 || typeof parsed.history !== "object" || parsed.history === null) {
    throw new Error("INVALID_HISTORY_FILE");
  }
  const history = parsed.history as UsageHistory;
  for (const [entryId, record] of Object.entries(history)) {
    if (
      record.entryId !== entryId ||
      !Number.isInteger(record.lastGameNumber) ||
      !Number.isInteger(record.useCount) ||
      record.useCount < 0
    ) throw new Error("INVALID_HISTORY_FILE");
  }
  saveHistory(history);
  return history;
}
