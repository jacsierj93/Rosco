import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { validateContent } from "../../shared/content/validation.js";
import type { ContentEntry } from "../../shared/validation/schemas.js";
import { readJsonArray } from "./io.js";

interface CsvRow {
  id?: string;
  answer?: string;
  acceptedVariants?: string;
  letter?: string;
  relation?: string;
  modes?: string;
  categories?: string;
  wordDifficulty?: string;
  clueInfantil?: string;
  clueFacil?: string;
  clueIntermedio?: string;
  clueAvanzado?: string;
  sourceName?: string;
  sourceUrl?: string;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function split(value?: string): string[] {
  return value?.split("|").map((item) => item.trim()).filter(Boolean) ?? [];
}

const input = argument("--input");
const output = argument("--output");
if (!input || !output) {
  console.error("Uso: npm run content:import -- --input palabras.csv --output content/general.json");
  process.exit(1);
}

const rows = parse(await readFile(resolve(input), "utf8"), {
  columns: true,
  bom: true,
  skip_empty_lines: true,
  trim: true
}) as CsvRow[];

const entries = rows.map((row): Partial<ContentEntry> => ({
  id: row.id,
  answer: row.answer,
  acceptedVariants: split(row.acceptedVariants),
  letter: row.letter?.toLocaleUpperCase("es") as ContentEntry["letter"],
  relation: row.relation as ContentEntry["relation"],
  modes: split(row.modes) as ContentEntry["modes"],
  categories: split(row.categories),
  wordDifficulty: Number(row.wordDifficulty),
  clues: {
    ...(row.clueInfantil ? { infantil: row.clueInfantil } : {}),
    ...(row.clueFacil ? { facil: row.clueFacil } : {}),
    ...(row.clueIntermedio ? { intermedio: row.clueIntermedio } : {}),
    ...(row.clueAvanzado ? { avanzado: row.clueAvanzado } : {})
  },
  source: { name: row.sourceName ?? "", url: row.sourceUrl ?? "" }
}));

const rawEntries = process.argv.includes("--append")
  ? [...await readJsonArray(output), ...entries]
  : entries;
const validation = validateContent(rawEntries);
for (const issue of validation.issues) {
  console.log(`${issue.severity.toUpperCase()} [${issue.code}]${issue.entryId ? ` ${issue.entryId}` : ""}: ${issue.message}`);
}
if (!validation.valid) {
  console.error("No se generó el JSON porque el CSV contiene errores.");
  process.exit(1);
}

await writeFile(resolve(output), `${JSON.stringify(validation.entries, null, 2)}\n`, "utf8");
console.log(`${process.argv.includes("--append") ? "Banco actualizado a" : "Importadas"} ${validation.entries.length} entradas en ${output}.`);
