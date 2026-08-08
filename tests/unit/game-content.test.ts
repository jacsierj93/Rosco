import { describe, expect, it } from "vitest";
import { contentForMode } from "../../client/src/lib/game-content.js";
import { ROSCO_LETTERS, type Difficulty, type GameMode } from "../../shared/domain/types.js";
import { generateRoscos } from "../../shared/generator/generate.js";
import { recordGameUsage } from "../../shared/generator/history.js";
import type { UsageHistory } from "../../shared/generator/types.js";

describe("contenido real del juego", () => {
  it.each(["general", "teocratico"] as GameMode[])(
    "carga el banco editorial de %s sin contenido demostrativo",
    (mode) => {
      const entries = contentForMode(mode);

      expect(entries.length).toBeGreaterThanOrEqual(200);
      expect(entries.every((entry) => entry.modes.includes(mode))).toBe(true);
      expect(entries.every((entry) => !entry.id.startsWith("demo-"))).toBe(true);
    }
  );

  it.each(["general", "teocratico"] as GameMode[])(
    "genera el lote infantil A-E de %s para cuatro jugadores",
    (mode) => {
      const result = generateRoscos({
        config: {
          mode,
          difficulty: "infantil",
          durationSeconds: 150,
          regionalWeight: 0,
          speechEnabled: true,
          soundEffectsEnabled: true,
          players: Array.from({ length: 4 }, (_, index) => ({ id: `n${index}`, name: `Niño ${index}` }))
        },
        entries: contentForMode(mode),
        history: {},
        gameNumber: 1,
        seed: `infantil-${mode}`,
        letters: ROSCO_LETTERS.slice(0, 5)
      });

      expect(result.players).toHaveLength(4);
      expect(result.players.every((player) => player.questions.length === 5)).toBe(true);
    }
  );

  it.each(
    (["general", "teocratico"] as GameMode[]).flatMap((mode) =>
      (["infantil", "facil", "intermedio", "avanzado"] as Difficulty[]).map((difficulty) => ({ mode, difficulty }))
    )
  )(
    "genera una partida completa de $mode para cuatro jugadores en nivel $difficulty",
    ({ mode, difficulty }) => {
      const result = generateRoscos({
        config: {
          mode,
          difficulty,
          durationSeconds: 120,
          regionalWeight: mode === "general" ? 0.3 : 0,
          speechEnabled: true,
          soundEffectsEnabled: true,
          players: Array.from({ length: 4 }, (_, index) => ({ id: `p${index}`, name: `J${index}` }))
        },
        entries: contentForMode(mode),
        history: {},
        gameNumber: 1,
        seed: `real-${mode}-${difficulty}`,
        letters: ROSCO_LETTERS
      });

      expect(result.players).toHaveLength(4);
      expect(result.players.every((player) => player.questions.length === 25)).toBe(true);
      expect(result.players.every((player) => player.questions.every((question) => question.options.length === 5))).toBe(true);
      expect(new Set(result.selectedEntryIds).size).toBe(100);
    }
  );

  it.each(
    (["general", "teocratico"] as GameMode[]).flatMap((mode) =>
      (["infantil", "facil", "intermedio", "avanzado"] as Difficulty[]).map((difficulty) => ({ mode, difficulty }))
    )
  )(
    "rota seis partidas de $mode/$difficulty sin repetir respuestas",
    ({ mode, difficulty }) => {
      let history: UsageHistory = {};
      const seen = new Set<string>();

      for (let gameNumber = 1; gameNumber <= 6; gameNumber += 1) {
        const result = generateRoscos({
          config: {
            mode,
            difficulty,
            durationSeconds: 120,
            regionalWeight: mode === "general" ? 0.3 : 0,
            speechEnabled: true,
            soundEffectsEnabled: true,
            players: Array.from({ length: 4 }, (_, index) => ({ id: `r${index}`, name: `J${index}` }))
          },
          entries: contentForMode(mode),
          history,
          gameNumber,
          seed: `rotation-${mode}-${difficulty}-${gameNumber}`,
          letters: ROSCO_LETTERS
        });

        expect(result.selectedEntryIds).toHaveLength(100);
        for (const entryId of result.selectedEntryIds) {
          expect(seen.has(entryId)).toBe(false);
          seen.add(entryId);
        }
        history = recordGameUsage(history, result.selectedEntryIds, gameNumber);
      }

      expect(seen.size).toBe(600);
    }
  );
});
