import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { normalizeForLetter } from "../../shared/content/validation.js";
import { ROSCO_LETTERS, type RoscoLetter } from "../../shared/domain/types.js";
import { readJsonArray } from "./io.js";

interface CandidateRow {
  answer?: string;
  letter?: string;
  relation?: string;
  categories?: string;
  sourceUrl?: string;
}

interface ExistingEntry {
  answer?: unknown;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function split(value?: string): string[] {
  return value?.split("|").map((item) => item.trim()).filter(Boolean) ?? [];
}

const input = argument("--input") ?? "content/sources/general-candidates-remaining.csv";
const existingPath = argument("--existing") ?? "content/general.json";
const expectedLettersArgument = argument("--letters");
const rows = parse(await readFile(resolve(input), "utf8"), {
  columns: true,
  bom: true,
  skip_empty_lines: true,
  trim: true
}) as CandidateRow[];
const existing = await readJsonArray(existingPath) as ExistingEntry[];
const existingAnswers = new Set(
  existing
    .filter((entry): entry is { answer: string } => typeof entry.answer === "string")
    .map((entry) => normalizeForLetter(entry.answer))
);
const seenAnswers = new Set<string>();
const counts = new Map<RoscoLetter, number>();
const errors: string[] = [];
let regional = 0;
let promoted = 0;

rows.forEach((row, index) => {
  const line = index + 2;
  const answer = row.answer?.trim() ?? "";
  const normalizedAnswer = normalizeForLetter(answer);
  const letter = row.letter?.toLocaleUpperCase("es") ?? "";
  const categories = split(row.categories);

  if (!answer) errors.push(`Línea ${line}: falta answer.`);
  if (!ROSCO_LETTERS.includes(letter as RoscoLetter)) {
    errors.push(`Línea ${line}: letra inválida “${letter}”.`);
  }
  if (row.relation !== "empieza" && row.relation !== "contiene") {
    errors.push(`Línea ${line}: relación inválida “${row.relation ?? ""}”.`);
  } else if (letter && !(
    row.relation === "empieza"
      ? normalizedAnswer.startsWith(letter)
      : normalizedAnswer.includes(letter)
  )) {
    errors.push(`Línea ${line}: “${answer}” no ${row.relation} con ${letter}.`);
  }
  if (categories.length === 0) errors.push(`Línea ${line}: falta al menos una categoría.`);
  if (categories.includes("lunfardo") || categories.includes("argentinismo")) regional += 1;

  try {
    const url = new URL(row.sourceUrl ?? "");
    if (url.protocol !== "https:") throw new Error();
  } catch {
    errors.push(`Línea ${line}: sourceUrl no es una URL HTTPS válida.`);
  }

  if (existingAnswers.has(normalizedAnswer)) {
    promoted += 1;
  }
  if (seenAnswers.has(normalizedAnswer)) {
    errors.push(`Línea ${line}: respuesta duplicada “${answer}”.`);
  }
  seenAnswers.add(normalizedAnswer);

  if (ROSCO_LETTERS.includes(letter as RoscoLetter)) {
    const roscoLetter = letter as RoscoLetter;
    counts.set(roscoLetter, (counts.get(roscoLetter) ?? 0) + 1);
  }
});

const expectedLetters = expectedLettersArgument
  ? expectedLettersArgument
      .split(",")
      .map((letter) => letter.trim().toLocaleUpperCase("es"))
      .filter((letter): letter is RoscoLetter => ROSCO_LETTERS.includes(letter as RoscoLetter))
  : ROSCO_LETTERS.filter((letter) => !["A", "B", "C", "D", "E"].includes(letter));

if (expectedLettersArgument && expectedLetters.length !== expectedLettersArgument.split(",").length) {
  errors.push(`--letters contiene una letra inválida: “${expectedLettersArgument}”.`);
}
if (new Set(expectedLetters).size !== expectedLetters.length) {
  errors.push("--letters no puede contener letras repetidas.");
}

for (const letter of expectedLetters) {
  const count = counts.get(letter) ?? 0;
  if (count !== 8) errors.push(`Letra ${letter}: hay ${count} candidatos; se esperaban 8.`);
}
for (const letter of ROSCO_LETTERS.filter((letter) => !expectedLetters.includes(letter))) {
  const count = counts.get(letter) ?? 0;
  if (count !== 0) errors.push(`Letra ${letter}: no pertenece a este lote, pero aparecen ${count} candidatos.`);
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  console.error(`\nValidación fallida con ${errors.length} error(es).`);
  process.exit(1);
}

console.log(`Candidatos válidos: ${rows.length}.`);
console.log(`Cobertura: ${expectedLetters.length}/${expectedLetters.length} letras con 8 candidatos.`);
console.log(`Términos regionales o lunfardos: ${regional}/${rows.length} (${Math.round(regional / rows.length * 100)}%).`);
console.log(`Promovidos al banco: ${promoted}; pendientes de redacción: ${rows.length - promoted}.`);
console.log(`Sin duplicados internos; banco existente: ${existingAnswers.size} respuestas.`);
