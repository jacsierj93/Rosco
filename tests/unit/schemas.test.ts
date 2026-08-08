import { describe, expect, it } from "vitest";
import { controlIntentSchema, gameConfigSchema } from "../../shared/validation/schemas.js";

describe("gameConfigSchema", () => {
  it("acepta hasta cuatro jugadores", () => {
    const result = gameConfigSchema.safeParse({
      mode: "general",
      difficulty: "intermedio",
      durationSeconds: 120,
      regionalWeight: 0.3,
      speechEnabled: true,
      soundEffectsEnabled: true,
      players: Array.from({ length: 4 }, (_, index) => ({ id: `p${index}`, name: `Jugador ${index}` }))
    });

    expect(result.success).toBe(true);
  });

  it("rechaza preferencia regional en modo teocrático", () => {
    const result = gameConfigSchema.safeParse({
      mode: "teocratico",
      difficulty: "facil",
      durationSeconds: 150,
      regionalWeight: 0.3,
      speechEnabled: true,
      soundEffectsEnabled: true,
      players: [{ id: "p1", name: "Ana" }]
    });

    expect(result.success).toBe(false);
  });
});

describe("acciones del control", () => {
  it("acepta volver al menú con una secuencia válida", () => {
    expect(controlIntentSchema.safeParse({ type: "EXIT_TO_MENU", sequence: 4 }).success).toBe(true);
  });

  it("acepta repetir la pista con una secuencia válida", () => {
    expect(controlIntentSchema.safeParse({ type: "REPEAT_CLUE", sequence: 5 }).success).toBe(true);
  });
});
