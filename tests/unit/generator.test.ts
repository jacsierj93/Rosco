import { describe, expect, it } from "vitest";
import { GenerationError } from "../../shared/generator/errors.js";
import { generateRoscos } from "../../shared/generator/generate.js";
import { recordGameUsage } from "../../shared/generator/history.js";
import { config, entriesForLetter } from "./generator-fixture.js";

describe("generateRoscos", () => {
  it("genera roscos deterministas sin respuestas repetidas", () => {
    const input = {
      config: config(2),
      entries: [...entriesForLetter("A"), ...entriesForLetter("B")],
      history: {},
      gameNumber: 1,
      seed: "partida-1",
      letters: ["A", "B"] as const
    };
    const first = generateRoscos(input);
    const second = generateRoscos(input);

    expect(second).toEqual(first);
    expect(first.players).toHaveLength(2);
    expect(first.players.every((player) => player.questions.length === 2)).toBe(true);
    expect(new Set(first.selectedEntryIds).size).toBe(4);
  });

  it("crea cinco opciones y nunca usa como distractor una respuesta asignada", () => {
    const result = generateRoscos({
      config: config(2),
      entries: entriesForLetter("A"),
      history: {},
      gameNumber: 1,
      seed: "opciones",
      letters: ["A"]
    });
    const selectedAnswers = new Set(result.players.map((player) => player.questions[0]?.answer));

    for (const player of result.players) {
      const question = player.questions[0];
      expect(question?.options).toHaveLength(5);
      expect(question?.options.filter((option) => selectedAnswers.has(option.label))).toHaveLength(1);
    }
  });

  it("respeta el enfriamiento y prioriza palabras nunca usadas", () => {
    const entries = entriesForLetter("A");
    const recentId = entries[0]?.id;
    if (!recentId) throw new Error("Fixture inválido");
    const result = generateRoscos({
      config: config(1),
      entries,
      history: { [recentId]: { entryId: recentId, lastGameNumber: 9, useCount: 1 } },
      gameNumber: 10,
      seed: "historial",
      letters: ["A"]
    });

    expect(result.selectedEntryIds).not.toContain(recentId);
  });

  it("reutiliza las menos recientes cuando todo el banco está en enfriamiento", () => {
    const entries = entriesForLetter("A", 6);
    const history = Object.fromEntries(entries.map((entry, index) => [
      entry.id,
      { entryId: entry.id, lastGameNumber: 9 - index, useCount: 1 }
    ]));

    const result = generateRoscos({
      config: config(1),
      entries,
      history,
      gameNumber: 10,
      seed: "reutilizacion",
      letters: ["A"]
    });

    expect(result.players).toHaveLength(1);
    expect(result.selectedEntryIds).toHaveLength(1);
  });

  it("falla con un error explicable si no alcanzan los distractores", () => {
    expect(() =>
      generateRoscos({
        config: config(2),
        entries: entriesForLetter("A", 5),
        history: {},
        gameNumber: 1,
        seed: "insuficiente",
        letters: ["A"]
      })
    ).toThrowError(GenerationError);
  });
});

describe("recordGameUsage", () => {
  it("registra cada palabra una sola vez por partida", () => {
    const result = recordGameUsage({}, ["a-1", "a-1", "b-1"], 4);

    expect(result["a-1"]).toEqual({ entryId: "a-1", lastGameNumber: 4, useCount: 1 });
    expect(result["b-1"]?.useCount).toBe(1);
  });
});
