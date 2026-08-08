import { describe, expect, it } from "vitest";
import { normalizeForLetter, validateContent } from "../../shared/content/validation.js";

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: "general-arbol",
    answer: "árbol",
    acceptedVariants: [],
    letter: "A",
    relation: "empieza",
    modes: ["general"],
    categories: ["general"],
    wordDifficulty: 1,
    clues: { facil: "Planta de tronco leñoso." },
    source: { name: "Fuente", url: "https://example.org/arbol" },
    ...overrides
  };
}

describe("validación editorial", () => {
  it("normaliza acentos sin convertir la Ñ en N", () => {
    expect(normalizeForLetter("Árbol")).toBe("ARBOL");
    expect(normalizeForLetter("ñandú")).toBe("ÑANDU");
  });

  it("detecta IDs y respuestas duplicadas", () => {
    const result = validateContent([entry(), entry()]);

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["DUPLICATE_ID", "DUPLICATE_ANSWER"])
    );
    expect(result.valid).toBe(false);
  });

  it("detecta una relación incorrecta entre respuesta y letra", () => {
    const result = validateContent([entry({ letter: "B" })]);

    expect(result.issues.some((issue) => issue.code === "LETTER_RELATION_MISMATCH")).toBe(true);
  });
});
