import { DomainError } from "./errors.js";
import type {
  AssignedQuestion,
  GameAction,
  GameState,
  PlayerState,
  QuestionStatus
} from "./types.js";

const ERROR_REVEAL_MS = 2_000;

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

function currentPlayer(state: GameState): PlayerState {
  const player = state.players[state.currentPlayerIndex];
  if (!player) throw new DomainError("INVALID_PLAYER");
  return player;
}

function currentQuestion(player: PlayerState): AssignedQuestion {
  const question = player.questions[player.cursor];
  if (!question) throw new DomainError("INVALID_QUESTION");
  return question;
}

function isPlayerAvailable(player: PlayerState): boolean {
  return player.remainingMs > 0 && player.questions.some((question) => question.status === "pending");
}

function findNextPending(player: PlayerState, fromIndex: number): number | null {
  const total = player.questions.length;
  for (let offset = 0; offset < total; offset += 1) {
    const index = (fromIndex + offset) % total;
    if (player.questions[index]?.status === "pending") return index;
  }
  return null;
}

function findNextPlayer(state: GameState, fromIndex: number): number | null {
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const index = (fromIndex + offset) % state.players.length;
    const candidate = state.players[index];
    if (candidate && isPlayerAvailable(candidate)) return index;
  }
  return null;
}

function consumeClock(state: GameState, nowMs: number): PlayerState {
  const player = currentPlayer(state);
  if (!state.activeClock || state.activeClock.playerId !== player.id) {
    throw new DomainError("INVALID_PHASE");
  }
  const elapsed = Math.max(0, nowMs - state.activeClock.startedAtMs);
  player.remainingMs = Math.max(0, player.remainingMs - elapsed);
  return player;
}

function hasReviews(state: GameState): boolean {
  return state.reviews.length > 0;
}

function finishOrWait(state: GameState): void {
  const nextPlayerIndex = findNextPlayer(state, state.currentPlayerIndex);
  state.activeClock = null;
  state.revealUntilMs = null;
  state.pausedFrom = null;

  if (nextPlayerIndex !== null) {
    state.currentPlayerIndex = nextPlayerIndex;
    state.phase = "between_turns";
    return;
  }

  state.phase = hasReviews(state) ? "reviewing" : "finished";
}

function continueOrRotate(state: GameState, player: PlayerState, nowMs: number): void {
  const nextQuestion = findNextPending(player, player.cursor + 1);
  if (player.remainingMs > 0 && nextQuestion !== null) {
    player.cursor = nextQuestion;
    state.activeClock = { playerId: player.id, startedAtMs: nowMs };
    state.phase = "turn_active";
    return;
  }
  finishOrWait(state);
}

function closePendingQuestions(player: PlayerState): void {
  for (const question of player.questions) {
    if (question.status === "pending") question.status = "unanswered";
  }
}

function markCurrentQuestion(
  state: GameState,
  status: Extract<QuestionStatus, "correct" | "incorrect" | "in_review">
): AssignedQuestion {
  const question = currentQuestion(currentPlayer(state));
  if (question.status !== "pending") throw new DomainError("INVALID_QUESTION");
  question.status = status;
  return question;
}

export function reduceGame(state: GameState, action: GameAction, nowMs: number): GameState {
  if (action.sequence !== state.sequence + 1) throw new DomainError("INVALID_SEQUENCE");

  const next = cloneState(state);
  next.sequence = action.sequence;

  switch (action.type) {
    case "START_TURN": {
      if (next.phase !== "ready" && next.phase !== "between_turns") {
        throw new DomainError("INVALID_PHASE");
      }
      const player = currentPlayer(next);
      const pending = findNextPending(player, player.cursor);
      if (pending === null || player.remainingMs <= 0) throw new DomainError("INVALID_PLAYER");
      player.cursor = pending;
      next.activeClock = { playerId: player.id, startedAtMs: nowMs };
      next.phase = "turn_active";
      return next;
    }

    case "SELECT_OPTION": {
      if (next.phase !== "turn_active") throw new DomainError("INVALID_PHASE");
      const player = consumeClock(next, nowMs);
      const question = currentQuestion(player);
      if (!question.options.some((option) => option.id === action.optionId)) {
        throw new DomainError("INVALID_OPTION");
      }
      if (action.optionId === question.correctOptionId) {
        markCurrentQuestion(next, "correct");
        continueOrRotate(next, player, nowMs);
      } else {
        markCurrentQuestion(next, "incorrect");
        next.phase = "revealing_error";
        next.revealUntilMs = nowMs + ERROR_REVEAL_MS;
        next.activeClock = null;
      }
      return next;
    }

    case "MARK_ANSWER": {
      if (next.phase !== "turn_active") throw new DomainError("INVALID_PHASE");
      const player = consumeClock(next, nowMs);
      if (action.result === "correct") {
        markCurrentQuestion(next, "correct");
        continueOrRotate(next, player, nowMs);
      } else {
        markCurrentQuestion(next, "incorrect");
        next.phase = "revealing_error";
        next.revealUntilMs = nowMs + ERROR_REVEAL_MS;
        next.activeClock = null;
      }
      return next;
    }

    case "ANSWER_NOT_LISTED": {
      if (next.phase !== "turn_active") throw new DomainError("INVALID_PHASE");
      const player = consumeClock(next, nowMs);
      const question = markCurrentQuestion(next, "in_review");
      next.reviews.push({
        playerId: player.id,
        questionId: question.id,
        ...(action.selectedLabel === undefined ? {} : { selectedLabel: action.selectedLabel })
      });
      continueOrRotate(next, player, nowMs);
      return next;
    }

    case "REPORT_CONTENT": {
      if (next.phase !== "turn_active") throw new DomainError("INVALID_PHASE");
      currentQuestion(currentPlayer(next));
      return next;
    }

    case "PASS": {
      if (next.phase !== "turn_active") throw new DomainError("INVALID_PHASE");
      const player = consumeClock(next, nowMs);
      player.cursor = (player.cursor + 1) % player.questions.length;
      if (player.remainingMs === 0) closePendingQuestions(player);
      finishOrWait(next);
      return next;
    }

    case "FINISH_REVEAL": {
      if (next.phase !== "revealing_error" || next.revealUntilMs === null) {
        throw new DomainError("INVALID_PHASE");
      }
      if (nowMs < next.revealUntilMs) throw new DomainError("TOO_EARLY");
      const player = currentPlayer(next);
      next.revealUntilMs = null;
      if (player.remainingMs === 0) closePendingQuestions(player);
      finishOrWait(next);
      return next;
    }

    case "EMERGENCY_PAUSE": {
      if (next.phase !== "turn_active") {
        throw new DomainError("INVALID_PHASE");
      }
      const previousPhase = next.phase;
      consumeClock(next, nowMs);
      next.activeClock = null;
      next.pausedFrom = previousPhase;
      next.phase = "paused";
      return next;
    }

    case "RESUME": {
      if (next.phase !== "paused" || next.pausedFrom === null) {
        throw new DomainError("INVALID_PHASE");
      }
      const player = currentPlayer(next);
      next.activeClock = { playerId: player.id, startedAtMs: nowMs };
      next.phase = next.pausedFrom;
      next.pausedFrom = null;
      return next;
    }

    case "REPEAT_CLUE": {
      if (next.phase !== "turn_active") throw new DomainError("INVALID_PHASE");
      currentQuestion(currentPlayer(next));
      return next;
    }

    case "TIME_EXPIRED": {
      if (next.phase !== "turn_active") {
        throw new DomainError("INVALID_PHASE");
      }
      const player = currentPlayer(next);
      player.remainingMs = 0;
      closePendingQuestions(player);
      finishOrWait(next);
      return next;
    }

    case "RESOLVE_REVIEW": {
      if (next.phase !== "reviewing") throw new DomainError("INVALID_PHASE");
      const player = next.players.find((candidate) => candidate.id === action.playerId);
      if (!player) throw new DomainError("INVALID_PLAYER");
      const question = player.questions.find((candidate) => candidate.id === action.questionId);
      if (!question || question.status !== "in_review") throw new DomainError("INVALID_QUESTION");
      question.status = action.result;
      next.reviews = next.reviews.filter(
        (review) => review.playerId !== action.playerId || review.questionId !== action.questionId
      );
      if (next.reviews.length === 0) next.phase = "finished";
      return next;
    }
  }
}
