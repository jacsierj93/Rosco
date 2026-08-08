import { z } from "zod";
import { ROSCO_LETTERS } from "../domain/types.js";

export const gameConfigSchema = z.object({
  mode: z.enum(["teocratico", "general"]),
  difficulty: z.enum(["infantil", "facil", "intermedio", "avanzado"]),
  durationSeconds: z.number().int().min(30).max(600),
  regionalWeight: z.number().min(0).max(0.5),
  speechEnabled: z.boolean().default(true),
  soundEffectsEnabled: z.boolean().default(true),
  players: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        name: z.string().trim().min(1).max(30)
      })
    )
    .min(1)
    .max(4)
}).superRefine((config, context) => {
  const ids = config.players.map((player) => player.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["players"], message: "Los IDs deben ser únicos" });
  }
  if (config.mode === "teocratico" && config.regionalWeight !== 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["regionalWeight"],
      message: "La preferencia regional solo se aplica al modo general"
    });
  }
});

export const contentEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  answer: z.string().trim().min(1),
  acceptedVariants: z.array(z.string().trim().min(1)).default([]),
  letter: z.enum(ROSCO_LETTERS),
  relation: z.enum(["empieza", "contiene"]),
  modes: z.array(z.enum(["teocratico", "general"])).min(1),
  categories: z.array(z.string().min(1)).default([]),
  wordDifficulty: z.number().int().min(1).max(3),
  clues: z.object({
    infantil: z.string().trim().min(1).optional(),
    facil: z.string().trim().min(1).optional(),
    intermedio: z.string().trim().min(1).optional(),
    avanzado: z.string().trim().min(1).optional()
  }).refine((clues) => Object.keys(clues).length > 0, "Debe existir al menos una pista"),
  source: z.object({
    name: z.string().trim().min(1),
    url: z.string().url()
  })
});

export const controlIntentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("START_TURN"), sequence: z.number().int().nonnegative() }),
  z.object({
    type: z.literal("MARK_ANSWER"),
    result: z.enum(["correct", "incorrect"]),
    sequence: z.number().int().nonnegative()
  }),
  z.object({
    type: z.literal("SELECT_OPTION"),
    optionId: z.string().min(1).max(128),
    sequence: z.number().int().nonnegative()
  }),
  z.object({
    type: z.literal("ANSWER_NOT_LISTED"),
    selectedLabel: z.string().trim().max(100).optional(),
    sequence: z.number().int().nonnegative()
  }),
  z.object({
    type: z.literal("REPORT_CONTENT"),
    reason: z.enum(["word_difficult", "clue_problem"]),
    sequence: z.number().int().nonnegative()
  }),
  z.object({ type: z.literal("PASS"), sequence: z.number().int().nonnegative() }),
  z.object({ type: z.literal("EMERGENCY_PAUSE"), sequence: z.number().int().nonnegative() }),
  z.object({ type: z.literal("RESUME"), sequence: z.number().int().nonnegative() }),
  z.object({ type: z.literal("REPEAT_CLUE"), sequence: z.number().int().nonnegative() }),
  z.object({ type: z.literal("UNDO"), sequence: z.number().int().nonnegative() }),
  z.object({
    type: z.literal("RESOLVE_REVIEW"),
    playerId: z.string().max(64),
    questionId: z.string().max(256),
    result: z.enum(["correct", "incorrect"]),
    sequence: z.number().int().nonnegative()
  }),
  z.object({ type: z.literal("REMATCH"), sequence: z.number().int().nonnegative() }),
  z.object({ type: z.literal("EXIT_TO_MENU"), sequence: z.number().int().nonnegative() })
]);

export type GameConfig = z.infer<typeof gameConfigSchema>;
export type ContentEntry = z.infer<typeof contentEntrySchema>;
