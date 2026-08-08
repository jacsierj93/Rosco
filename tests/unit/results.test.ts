import { describe, expect, it } from "vitest";
import { prepareGameForRecovery } from "../../shared/domain/recovery.js";
import { calculateResults } from "../../shared/domain/results.js";
import { game, player, question } from "./game-fixture.js";

describe("calculateResults", () => {
  it("ordena por aciertos, errores y tiempo restante", () => {
    const p1 = player("p1", [question("q1", "A"), question("q2", "B")]);
    const p2 = player("p2", [question("q3", "A"), question("q4", "B")]);
    if (p1.questions[0]) p1.questions[0].status = "correct";
    if (p1.questions[1]) p1.questions[1].status = "incorrect";
    if (p2.questions[0]) p2.questions[0].status = "correct";
    p1.remainingMs = 100_000;
    p2.remainingMs = 90_000;

    const results = calculateResults(game([p1, p2]));

    expect(results.map((result) => result.playerId)).toEqual(["p2", "p1"]);
    expect(results[0]?.position).toBe(1);
  });
});

describe("prepareGameForRecovery", () => {
  it("recupera un turno activo en pausa descontando el tiempo transcurrido", () => {
    const state = game();
    state.phase = "turn_active";
    state.activeClock = { playerId: "p1", startedAtMs: 1_000 };

    const recovered = prepareGameForRecovery(state, 6_000);

    expect(recovered.phase).toBe("paused");
    expect(recovered.players[0]?.remainingMs).toBe(115_000);
    expect(recovered.activeClock).toBeNull();
  });
});
