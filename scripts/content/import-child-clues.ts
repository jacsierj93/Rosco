import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { validateContent } from "../../shared/content/validation.js";
import { readJsonArray } from "./io.js";

interface ChildClueRow { id?: string; clueInfantil?: string }

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const input = argument("--input");
const output = argument("--output");
if (!input || !output) {
  console.error("Uso: npm run content:infantil -- --input pistas.csv --output content/general.json");
  process.exit(1);
}

const rows = parse(await readFile(resolve(input), "utf8"), {
  columns: true,
  bom: true,
  skip_empty_lines: true,
  trim: true
}) as ChildClueRow[];
const clues = new Map(rows.map((row) => [row.id, row.clueInfantil]));
if ([...clues].some(([id, clue]) => !id || !clue) || clues.size !== rows.length) {
  throw new Error("Cada fila necesita un id único y una pista infantil.");
}

const rawEntries = await readJsonArray(output);
const knownIds = new Set(rawEntries.map((entry) => (entry as { id?: string }).id));
const missing = [...clues.keys()].filter((id) => !knownIds.has(id));
if (missing.length > 0) throw new Error(`IDs inexistentes: ${missing.join(", ")}`);

const updated = rawEntries.map((raw) => {
  const entry = raw as { id: string; clues: Record<string, string> };
  const clue = clues.get(entry.id);
  return clue ? { ...entry, clues: { infantil: clue, ...entry.clues } } : entry;
});
const validation = validateContent(updated);
if (!validation.valid) {
  for (const issue of validation.issues) console.error(`${issue.code}: ${issue.message}`);
  process.exit(1);
}
await writeFile(resolve(output), `${JSON.stringify(validation.entries, null, 2)}\n`, "utf8");
console.log(`Actualizadas ${clues.size} pistas infantiles en ${output}.`);
