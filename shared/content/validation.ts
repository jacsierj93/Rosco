import { ROSCO_LETTERS, type Difficulty, type RoscoLetter } from "../domain/types.js";
import { analyzeCoverage } from "../generator/coverage.js";
import { contentEntrySchema, type ContentEntry } from "../validation/schemas.js";

export interface ContentIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  entryId?: string;
}

export interface ContentValidationResult {
  entries: ContentEntry[];
  issues: ContentIssue[];
  valid: boolean;
}

export function normalizeForLetter(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase("es")
    .replaceAll("Ñ", "\u0000")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("\u0000", "Ñ");
}

function validateRelation(entry: ContentEntry): ContentIssue | null {
  const answer = normalizeForLetter(entry.answer);
  const valid = entry.relation === "empieza"
    ? answer.startsWith(entry.letter)
    : answer.includes(entry.letter);
  return valid ? null : {
    severity: "error",
    code: "LETTER_RELATION_MISMATCH",
    entryId: entry.id,
    message: `La respuesta “${entry.answer}” no ${entry.relation === "empieza" ? "empieza" : "contiene"} con ${entry.letter}.`
  };
}

export function validateContent(rawEntries: unknown[]): ContentValidationResult {
  const entries: ContentEntry[] = [];
  const issues: ContentIssue[] = [];
  const ids = new Set<string>();
  const answersByMode = new Set<string>();

  rawEntries.forEach((rawEntry, index) => {
    const parsed = contentEntrySchema.safeParse(rawEntry);
    if (!parsed.success) {
      issues.push({
        severity: "error",
        code: "INVALID_SCHEMA",
        message: `Entrada ${index + 1}: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`
      });
      return;
    }
    const entry = parsed.data;
    if (ids.has(entry.id)) {
      issues.push({ severity: "error", code: "DUPLICATE_ID", entryId: entry.id, message: `ID duplicado: ${entry.id}.` });
    }
    ids.add(entry.id);

    for (const mode of entry.modes) {
      const answerKey = `${mode}:${normalizeForLetter(entry.answer)}`;
      if (answersByMode.has(answerKey)) {
        issues.push({ severity: "error", code: "DUPLICATE_ANSWER", entryId: entry.id, message: `Respuesta duplicada en el modo ${mode}: ${entry.answer}.` });
      }
      answersByMode.add(answerKey);
    }

    const relationIssue = validateRelation(entry);
    if (relationIssue) issues.push(relationIssue);
    if (entry.acceptedVariants.some(
      (variant) => variant.trim().toLocaleLowerCase("es") === entry.answer.trim().toLocaleLowerCase("es")
    )) {
      issues.push({ severity: "warning", code: "REDUNDANT_VARIANT", entryId: entry.id, message: "Una variante repite la respuesta principal." });
    }
    if (entry.source.url.includes("example.com")) {
      issues.push({ severity: "warning", code: "PLACEHOLDER_SOURCE", entryId: entry.id, message: "La fuente todavía es un enlace de ejemplo." });
    }
    entries.push(entry);
  });

  return { entries, issues, valid: !issues.some((issue) => issue.severity === "error") };
}

export function releaseCoverageIssues(entries: ContentEntry[]): ContentIssue[] {
  const issues: ContentIssue[] = [];
  for (const mode of ["general", "teocratico"] as const) {
    for (const difficulty of ["infantil", "facil", "intermedio", "avanzado"] as Difficulty[]) {
      const report = analyzeCoverage(entries, mode, difficulty, 4, 4);
      for (const cell of report.cells.filter((candidate) => !candidate.sustainable)) {
        issues.push({
          severity: "error",
          code: "INSUFFICIENT_SUSTAINABLE_COVERAGE",
          message: `${mode}/${difficulty}/${cell.letter}: admite ${cell.supportsPlayers} de 4 jugadores; ${cell.candidates} candidatos. ` +
            "Se necesitan al menos 28 términos compatibles por relación para seis partidas consecutivas, cuatro jugadores y cuatro distractores."
        });
      }
    }
  }
  return issues;
}

export function coverageMatrix(entries: ContentEntry[], mode: "general" | "teocratico", difficulty: Difficulty) {
  const report = analyzeCoverage(entries, mode, difficulty, 4, 4);
  return Object.fromEntries(
    ROSCO_LETTERS.map((letter: RoscoLetter) => {
      const cell = report.cells.find((candidate) => candidate.letter === letter);
      return [letter, cell ?? null];
    })
  );
}
