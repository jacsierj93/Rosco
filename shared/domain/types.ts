export const ROSCO_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "L", "M", "N",
  "Ñ", "O", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z"
] as const;

export type RoscoLetter = (typeof ROSCO_LETTERS)[number];
export type GameMode = "teocratico" | "general";
export type Difficulty = "infantil" | "facil" | "intermedio" | "avanzado";
export type LetterRelation = "empieza" | "contiene";
export type QuestionStatus = "pending" | "correct" | "incorrect" | "in_review" | "unanswered";

export type GamePhase =
  | "ready"
  | "between_turns"
  | "turn_active"
  | "revealing_error"
  | "paused"
  | "reviewing"
  | "finished";

export interface AnswerOption {
  id: string;
  label: string;
}

export interface AssignedQuestion {
  id: string;
  letter: RoscoLetter;
  relation: LetterRelation;
  clue: string;
  answer: string;
  acceptedVariants: string[];
  source: { name: string; url: string };
  options: AnswerOption[];
  correctOptionId: string;
  status: QuestionStatus;
}

export interface PlayerState {
  id: string;
  name: string;
  remainingMs: number;
  questions: AssignedQuestion[];
  cursor: number;
}

export interface ActiveClock {
  playerId: string;
  startedAtMs: number;
}

export interface ReviewRecord {
  playerId: string;
  questionId: string;
  selectedLabel?: string;
}

export interface GameState {
  id: string;
  mode: GameMode;
  difficulty: Difficulty;
  speechEnabled: boolean;
  soundEffectsEnabled: boolean;
  phase: GamePhase;
  sequence: number;
  players: PlayerState[];
  currentPlayerIndex: number;
  activeClock: ActiveClock | null;
  revealUntilMs: number | null;
  reviews: ReviewRecord[];
  pausedFrom: "turn_active" | "revealing_error" | null;
}

export type GameAction =
  | { type: "START_TURN"; sequence: number }
  | { type: "MARK_ANSWER"; result: "correct" | "incorrect"; sequence: number }
  | { type: "SELECT_OPTION"; optionId: string; sequence: number }
  | { type: "ANSWER_NOT_LISTED"; selectedLabel?: string; sequence: number }
  | { type: "REPORT_CONTENT"; reason: "word_difficult" | "clue_problem"; sequence: number }
  | { type: "PASS"; sequence: number }
  | { type: "FINISH_REVEAL"; sequence: number }
  | { type: "EMERGENCY_PAUSE"; sequence: number }
  | { type: "RESUME"; sequence: number }
  | { type: "REPEAT_CLUE"; sequence: number }
  | { type: "TIME_EXPIRED"; sequence: number }
  | {
      type: "RESOLVE_REVIEW";
      playerId: string;
      questionId: string;
      result: "correct" | "incorrect";
      sequence: number;
    };
