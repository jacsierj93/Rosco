import type { AssignedQuestion, GameState, PlayerState, RoscoLetter } from "../../shared/domain/types.js";

export function question(id: string, letter: RoscoLetter): AssignedQuestion {
  return {
    id,
    letter,
    relation: "empieza",
    clue: `Pista ${id}`,
    answer: `Respuesta ${id}`,
    acceptedVariants: [],
    source: { name: "Fuente de prueba", url: "https://example.com" },
    options: [
      { id: `${id}-correct`, label: `Respuesta ${id}` },
      { id: `${id}-wrong`, label: `Error ${id}` }
    ],
    correctOptionId: `${id}-correct`,
    status: "pending"
  };
}

export function player(id: string, questions: AssignedQuestion[]): PlayerState {
  return { id, name: id.toUpperCase(), remainingMs: 120_000, questions, cursor: 0 };
}

export function game(players?: PlayerState[]): GameState {
  return {
    id: "game-1",
    mode: "general",
    difficulty: "intermedio",
    speechEnabled: true,
    soundEffectsEnabled: true,
    phase: "ready",
    sequence: 0,
    players: players ?? [player("p1", [question("q1", "A"), question("q2", "B")])],
    currentPlayerIndex: 0,
    activeClock: null,
    revealUntilMs: null,
    reviews: [],
    pausedFrom: null
  };
}
