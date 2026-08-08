import type { RoscoLetter } from "../domain/types.js";

export class GenerationError extends Error {
  constructor(
    public readonly code: "INSUFFICIENT_ANSWERS" | "INSUFFICIENT_DISTRACTORS",
    public readonly letter: RoscoLetter,
    public readonly details: { required: number; available: number; relation?: "empieza" | "contiene" }
  ) {
    super(`${code}:${letter}`);
    this.name = "GenerationError";
  }
}

