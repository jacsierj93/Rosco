import type { GameState } from "./types.js";

export interface ControlView {
  gameId: string;
  phase: GameState["phase"];
  sequence: number;
  player?: { id: string; name: string; remainingMs: number };
  letter?: string;
  answer?: string;
  canStart: boolean;
  canPass: boolean;
  canEmergencyPause: boolean;
  canResume: boolean;
  canUndo: boolean;
  canRepeatClue: boolean;
  soundEffectsEnabled: boolean;
  review?: {
    playerId: string;
    playerName: string;
    questionId: string;
    letter: string;
    answer: string;
    selectedLabel?: string;
  };
}

export function createControlView(state: GameState, options: { canUndo?: boolean } = {}): ControlView {
  const player = state.players[state.currentPlayerIndex];
  const question = player?.questions[player.cursor];
  const active = state.phase === "turn_active";
  const reviewRecord = state.phase === "reviewing" ? state.reviews[0] : undefined;
  const reviewPlayer = reviewRecord
    ? state.players.find((candidate) => candidate.id === reviewRecord.playerId)
    : undefined;
  const reviewQuestion = reviewRecord
    ? reviewPlayer?.questions.find((candidate) => candidate.id === reviewRecord.questionId)
    : undefined;

  return {
    gameId: state.id,
    phase: state.phase,
    sequence: state.sequence,
    ...(player
      ? { player: { id: player.id, name: player.name, remainingMs: player.remainingMs } }
      : {}),
    ...(active && question ? { letter: question.letter, answer: question.answer } : {}),
    canStart: state.phase === "ready" || state.phase === "between_turns",
    canPass: active,
    canEmergencyPause: active,
    canResume: state.phase === "paused",
    canUndo: options.canUndo ?? false,
    canRepeatClue: active && state.speechEnabled,
    soundEffectsEnabled: state.soundEffectsEnabled,
    ...(reviewRecord && reviewPlayer && reviewQuestion
      ? {
          review: {
            playerId: reviewPlayer.id,
            playerName: reviewPlayer.name,
            questionId: reviewQuestion.id,
            letter: reviewQuestion.letter,
            answer: reviewQuestion.answer,
            ...(reviewRecord.selectedLabel === undefined ? {} : { selectedLabel: reviewRecord.selectedLabel })
          }
        }
      : {})
  };
}
