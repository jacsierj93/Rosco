import { describe, expect, it } from "vitest";
import { DomainError } from "../../shared/domain/errors.js";
import { reduceGame } from "../../shared/domain/reducer.js";
import { game, player, question } from "./game-fixture.js";

describe("reduceGame", () => {
  it("inicia el reloj solo por una acción explícita", () => {
    const result = reduceGame(game(), { type: "START_TURN", sequence: 1 }, 1_000);

    expect(result.phase).toBe("turn_active");
    expect(result.activeClock).toEqual({ playerId: "p1", startedAtMs: 1_000 });
  });

  it("avanza después de una respuesta correcta sin detener el reloj", () => {
    const started = reduceGame(game(), { type: "START_TURN", sequence: 1 }, 1_000);
    const result = reduceGame(
      started,
      { type: "MARK_ANSWER", result: "correct", sequence: 2 },
      4_000
    );

    expect(result.players[0]?.questions[0]?.status).toBe("correct");
    expect(result.players[0]?.cursor).toBe(1);
    expect(result.players[0]?.remainingMs).toBe(117_000);
    expect(result.activeClock?.startedAtMs).toBe(4_000);
    expect(result.phase).toBe("turn_active");
  });

  it("detiene el reloj y cierra el turno después de revelar un error", () => {
    const started = reduceGame(game(), { type: "START_TURN", sequence: 1 }, 1_000);
    const wrong = reduceGame(
      started,
      { type: "MARK_ANSWER", result: "incorrect", sequence: 2 },
      4_000
    );

    expect(wrong.phase).toBe("revealing_error");
    expect(wrong.revealUntilMs).toBe(6_000);
    expect(wrong.players[0]?.remainingMs).toBe(117_000);
    expect(wrong.activeClock).toBeNull();

    const continued = reduceGame(wrong, { type: "FINISH_REVEAL", sequence: 3 }, 6_000);
    expect(continued.players[0]?.remainingMs).toBe(117_000);
    expect(continued.phase).toBe("between_turns");
    expect(continued.activeClock).toBeNull();
  });

  it("después de un error prepara al siguiente jugador", () => {
    const initial = game([
      player("p1", [question("q1", "A"), question("q2", "B")]),
      player("p2", [question("q3", "A"), question("q4", "B")])
    ]);
    const started = reduceGame(initial, { type: "START_TURN", sequence: 1 }, 1_000);
    const wrong = reduceGame(started, { type: "MARK_ANSWER", result: "incorrect", sequence: 2 }, 2_000);
    const result = reduceGame(wrong, { type: "FINISH_REVEAL", sequence: 3 }, 4_000);

    expect(result.currentPlayerIndex).toBe(1);
    expect(result.phase).toBe("between_turns");
  });

  it("rechaza terminar la revelación antes de tiempo", () => {
    const started = reduceGame(game(), { type: "START_TURN", sequence: 1 }, 1_000);
    const wrong = reduceGame(
      started,
      { type: "MARK_ANSWER", result: "incorrect", sequence: 2 },
      2_000
    );

    expect(() => reduceGame(wrong, { type: "FINISH_REVEAL", sequence: 3 }, 3_000)).toThrowError(
      new DomainError("TOO_EARLY")
    );
  });

  it("pasapalabra detiene el reloj y rota al siguiente jugador", () => {
    const initial = game([
      player("p1", [question("q1", "A"), question("q2", "B")]),
      player("p2", [question("q3", "A"), question("q4", "B")])
    ]);
    const started = reduceGame(initial, { type: "START_TURN", sequence: 1 }, 1_000);
    const result = reduceGame(started, { type: "PASS", sequence: 2 }, 6_000);

    expect(result.players[0]?.remainingMs).toBe(115_000);
    expect(result.players[0]?.questions[0]?.status).toBe("pending");
    expect(result.currentPlayerIndex).toBe(1);
    expect(result.phase).toBe("between_turns");
    expect(result.activeClock).toBeNull();
  });

  it("una respuesta no listada queda para revisión y permite continuar", () => {
    const started = reduceGame(game(), { type: "START_TURN", sequence: 1 }, 1_000);
    const result = reduceGame(
      started,
      { type: "ANSWER_NOT_LISTED", selectedLabel: "otra", sequence: 2 },
      2_000
    );

    expect(result.players[0]?.questions[0]?.status).toBe("in_review");
    expect(result.reviews).toEqual([{ playerId: "p1", questionId: "q1", selectedLabel: "otra" }]);
    expect(result.players[0]?.cursor).toBe(1);
    expect(result.phase).toBe("turn_active");
  });

  it("ignora dobles pulsaciones mediante la secuencia", () => {
    const started = reduceGame(game(), { type: "START_TURN", sequence: 1 }, 1_000);

    expect(() =>
      reduceGame(started, { type: "MARK_ANSWER", result: "correct", sequence: 1 }, 2_000)
    ).toThrowError(new DomainError("INVALID_SEQUENCE"));
  });

  it("registra un reporte editorial sin alterar la pregunta ni el reloj", () => {
    const started = reduceGame(game(), { type: "START_TURN", sequence: 1 }, 1_000);
    const result = reduceGame(
      started,
      { type: "REPORT_CONTENT", reason: "word_difficult", sequence: 2 },
      2_000
    );

    expect(result.phase).toBe("turn_active");
    expect(result.players[0]?.questions[0]?.status).toBe("pending");
    expect(result.players[0]?.remainingMs).toBe(120_000);
    expect(result.activeClock).toEqual({ playerId: "p1", startedAtMs: 1_000 });
  });

  it("permite repetir la pista sin alterar la pregunta ni el reloj", () => {
    const started = reduceGame(game(), { type: "START_TURN", sequence: 1 }, 1_000);
    const result = reduceGame(started, { type: "REPEAT_CLUE", sequence: 2 }, 2_000);

    expect(result.phase).toBe("turn_active");
    expect(result.players[0]?.questions[0]?.status).toBe("pending");
    expect(result.activeClock).toEqual({ playerId: "p1", startedAtMs: 1_000 });
  });

  it("pausa y reanuda sin consumir el tiempo pausado", () => {
    const started = reduceGame(game(), { type: "START_TURN", sequence: 1 }, 1_000);
    const paused = reduceGame(started, { type: "EMERGENCY_PAUSE", sequence: 2 }, 4_000);
    const resumed = reduceGame(paused, { type: "RESUME", sequence: 3 }, 20_000);
    const passed = reduceGame(resumed, { type: "PASS", sequence: 4 }, 22_000);

    expect(passed.players[0]?.remainingMs).toBe(115_000);
  });

  it("cierra preguntas pendientes cuando se agota el tiempo", () => {
    const started = reduceGame(game(), { type: "START_TURN", sequence: 1 }, 1_000);
    const result = reduceGame(started, { type: "TIME_EXPIRED", sequence: 2 }, 121_000);

    expect(result.players[0]?.remainingMs).toBe(0);
    expect(result.players[0]?.questions.every((item) => item.status === "unanswered")).toBe(true);
    expect(result.phase).toBe("finished");
  });
});
