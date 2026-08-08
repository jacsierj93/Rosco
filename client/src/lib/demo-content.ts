import { ROSCO_LETTERS, type RoscoLetter } from "../../../shared/domain/types.js";
import type { ContentEntry } from "../../../shared/validation/schemas.js";

const BASE_WORDS: Record<RoscoLetter, string> = {
  A: "Aventura", B: "Biblioteca", C: "Camino", D: "Destino", E: "Encuentro",
  F: "Faro", G: "Girasol", H: "Horizonte", I: "Ingenio", J: "Jardín", L: "Linterna",
  M: "Montaña", N: "Nube", Ñ: "Ñandú", O: "Océano", P: "Puente", Q: "Quimera",
  R: "Ronda", S: "Sendero", T: "Tesoro", U: "Universo", V: "Ventana", X: "Xilófono",
  Y: "Yacaré", Z: "Zorzal"
};

export function createDemoContent(mode: "general" | "teocratico"): ContentEntry[] {
  return ROSCO_LETTERS.flatMap((letter) =>
    Array.from({ length: 34 }, (_, index) => {
      const number = index + 1;
      const answer = `${BASE_WORDS[letter]} ${number}`;
      const theme = mode === "teocratico" ? "teocrático" : "general";
      return {
        id: `demo-${mode}-${letter.toLowerCase()}-${number}`,
        answer,
        acceptedVariants: [],
        letter,
        relation: "empieza" as const,
        modes: [mode],
        categories: mode === "general" && index < 3 ? ["argentinismo"] : [theme],
        wordDifficulty: 1,
        clues: {
          facil: `Contenido de demostración: elegí la opción “${answer}”.`,
          intermedio: `Prueba del rosco: la respuesta es “${answer}”.`,
          avanzado: `Entrada experimental identificada como “${answer}”.`
        },
        source: { name: "Banco temporal de demostración", url: "https://example.com/rosco-demo" }
      };
    })
  );
}
