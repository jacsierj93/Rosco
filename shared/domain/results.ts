import type { GameState, PlayerState } from "./types.js";

export interface PlayerResult {
  playerId: string;
  name: string;
  correct: number;
  incorrect: number;
  unanswered: number;
  remainingMs: number;
  position: number;
}

function comparePlayers(left: PlayerState, right: PlayerState): number {
  const leftCorrect = left.questions.filter((question) => question.status === "correct").length;
  const rightCorrect = right.questions.filter((question) => question.status === "correct").length;
  if (leftCorrect !== rightCorrect) return rightCorrect - leftCorrect;
  const leftIncorrect = left.questions.filter((question) => question.status === "incorrect").length;
  const rightIncorrect = right.questions.filter((question) => question.status === "incorrect").length;
  if (leftIncorrect !== rightIncorrect) return leftIncorrect - rightIncorrect;
  return right.remainingMs - left.remainingMs;
}

export function calculateResults(state: GameState): PlayerResult[] {
  const ordered = [...state.players].sort(comparePlayers);
  let previous: PlayerState | undefined;
  let position = 0;
  return ordered.map((player, index) => {
    if (!previous || comparePlayers(previous, player) !== 0) position = index + 1;
    previous = player;
    return {
      playerId: player.id,
      name: player.name,
      correct: player.questions.filter((question) => question.status === "correct").length,
      incorrect: player.questions.filter((question) => question.status === "incorrect").length,
      unanswered: player.questions.filter(
        (question) => question.status === "pending" || question.status === "unanswered"
      ).length,
      remainingMs: player.remainingMs,
      position
    };
  });
}
