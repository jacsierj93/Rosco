import type { RoscoLetter } from "../../shared/domain/types.js";
import type { ContentEntry } from "../../shared/validation/schemas.js";

export function entriesForLetter(letter: RoscoLetter, count = 10): ContentEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${letter.toLowerCase()}-${index}`,
    answer: `${letter} palabra ${index}`,
    acceptedVariants: [],
    letter,
    relation: "empieza" as const,
    modes: ["general" as const],
    categories: index < 3 ? ["lunfardo"] : ["general"],
    wordDifficulty: 1,
    clues: {
      facil: `Pista fácil ${letter} ${index}`,
      intermedio: `Pista intermedia ${letter} ${index}`,
      avanzado: `Pista avanzada ${letter} ${index}`
    },
    source: { name: "Fuente de prueba", url: "https://example.com" }
  }));
}

export function config(playerCount = 2) {
  return {
    mode: "general" as const,
    difficulty: "intermedio" as const,
    durationSeconds: 120,
    regionalWeight: 0.3,
    speechEnabled: true,
    soundEffectsEnabled: true,
    players: Array.from({ length: playerCount }, (_, index) => ({
      id: `p${index + 1}`,
      name: `Jugador ${index + 1}`
    }))
  };
}
