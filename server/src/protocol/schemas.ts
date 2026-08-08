import { z } from "zod";
import { controlIntentSchema, gameConfigSchema } from "../../../shared/validation/schemas.js";

export const joinControlSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/),
  token: z.string().min(20).max(128)
});

export const resumeDisplaySchema = z.object({
  credential: z.string().min(40).max(1_024),
  controlToken: z.string().min(20).max(128).optional()
});

export const controlViewSchema = z.object({
  gameId: z.string().min(1).max(128),
  phase: z.enum(["ready", "between_turns", "turn_active", "revealing_error", "paused", "reviewing", "finished"]),
  sequence: z.number().int().nonnegative(),
  player: z.object({ id: z.string().max(64), name: z.string().max(30), remainingMs: z.number().nonnegative() }).optional(),
  letter: z.string().max(2).optional(),
  answer: z.string().max(100).optional(),
  canStart: z.boolean(),
  canPass: z.boolean(),
  canEmergencyPause: z.boolean(),
  canResume: z.boolean(),
  canUndo: z.boolean(),
  canRepeatClue: z.boolean(),
  soundEffectsEnabled: z.boolean(),
  review: z.object({
    playerId: z.string().max(64),
    playerName: z.string().max(30),
    questionId: z.string().max(256),
    letter: z.string().max(2),
    answer: z.string().max(100),
    selectedLabel: z.string().max(100).optional()
  }).optional()
});

export const displayStateSchema = z.object({
  roomId: z.string().uuid(),
  view: controlViewSchema
});

export const controlIntentEnvelopeSchema = z.object({
  roomId: z.string().uuid(),
  intent: controlIntentSchema
});

export const configurationEnvelopeSchema = z.object({
  roomId: z.string().uuid(),
  config: gameConfigSchema
});

export const roomEnvelopeSchema = z.object({ roomId: z.string().uuid() });
