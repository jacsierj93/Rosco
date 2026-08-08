import { mkdir, writeFile } from "node:fs/promises";
import { coverageMatrix, validateContent } from "../../shared/content/validation.js";
import type { Difficulty } from "../../shared/domain/types.js";
import { readAllContent } from "./io.js";

const validation = validateContent(await readAllContent());
if (!validation.valid) {
  console.error("El contenido tiene errores estructurales. Ejecutá npm run content:validate.");
  process.exitCode = 1;
} else {
  const report: Record<string, unknown> = { generatedAt: new Date().toISOString(), totalEntries: validation.entries.length, modes: {} };
  for (const mode of ["general", "teocratico"] as const) {
    const modeReport: Record<string, unknown> = {};
    for (const difficulty of ["infantil", "facil", "intermedio", "avanzado"] as Difficulty[]) {
      const matrix = coverageMatrix(validation.entries, mode, difficulty);
      modeReport[difficulty] = matrix;
      const ready = Object.values(matrix).filter((cell) => cell?.ready).length;
      const sustainable = Object.values(matrix).filter((cell) => cell?.sustainable).length;
      console.log(`${mode.padEnd(11)} ${difficulty.padEnd(10)} ${ready}/25 jugables · ${sustainable}/25 sostenibles`);
    }
    (report.modes as Record<string, unknown>)[mode] = modeReport;
  }
  await mkdir("reports", { recursive: true });
  await writeFile("reports/content-coverage.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("\nReporte detallado: reports/content-coverage.json");
}
