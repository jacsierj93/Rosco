import { describe, expect, it } from "vitest";
import { createDemoContent } from "../../client/src/lib/demo-content.js";
import { ROSCO_LETTERS } from "../../shared/domain/types.js";
import { generateRoscos } from "../../shared/generator/generate.js";

describe("banco de demostración", () => {
  it("genera 25 preguntas y cinco opciones para cuatro jugadores", () => {
    const result = generateRoscos({
      config: {
        mode: "general",
        difficulty: "intermedio",
        durationSeconds: 120,
        regionalWeight: 0.3,
        speechEnabled: true,
        soundEffectsEnabled: true,
        players: Array.from({ length: 4 }, (_, index) => ({ id: `p${index}`, name: `J${index}` }))
      },
      entries: createDemoContent("general"),
      history: {},
      gameNumber: 1,
      seed: "demo-completo",
      letters: ROSCO_LETTERS
    });

    expect(result.players).toHaveLength(4);
    expect(result.players.every((player) => player.questions.length === 25)).toBe(true);
    expect(result.players.every((player) => player.questions.every((question) => question.options.length === 5))).toBe(true);
    expect(new Set(result.selectedEntryIds).size).toBe(100);
  });
});
