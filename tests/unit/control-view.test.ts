import { describe, expect, it } from "vitest";
import { createControlView } from "../../shared/domain/control-view.js";
import { reduceGame } from "../../shared/domain/reducer.js";
import { game } from "./game-fixture.js";

describe("createControlView", () => {
  it("envía la respuesta correcta pero no la pista ni opciones al teléfono", () => {
    const started = reduceGame(game(), { type: "START_TURN", sequence: 1 }, 1_000);
    const view = createControlView(started);
    const serialized = JSON.stringify(view);

    expect(view.answer).toBe("Respuesta q1");
    expect(view.letter).toBe("A");
    expect(view.canRepeatClue).toBe(true);
    expect(view.soundEffectsEnabled).toBe(true);
    expect(serialized).not.toContain("Pista q1");
    expect(serialized).not.toContain("correctOptionId");
    expect(serialized).not.toContain('"options"');
  });

  it("oculta la respuesta entre turnos", () => {
    const view = createControlView(game());

    expect(view.answer).toBeUndefined();
    expect(view.letter).toBeUndefined();
    expect(view.canStart).toBe(true);
    expect(view.canResume).toBe(false);
    expect(view.canUndo).toBe(false);
  });

  it("expone solo los datos necesarios durante una revisión", () => {
    const state = game();
    const item = state.players[0]?.questions[0];
    if (!item) throw new Error("Fixture inválido");
    item.status = "in_review";
    state.phase = "reviewing";
    state.reviews = [{ playerId: "p1", questionId: item.id, selectedLabel: "respuesta oral" }];

    const view = createControlView(state, { canUndo: true });

    expect(view.review).toMatchObject({ playerName: "P1", letter: "A", answer: "Respuesta q1" });
    expect(view.canUndo).toBe(true);
  });
});
