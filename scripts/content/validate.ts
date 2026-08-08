import { readAllContent } from "./io.js";
import { releaseCoverageIssues, validateContent } from "../../shared/content/validation.js";

const requireCoverage = process.argv.includes("--require-coverage");
const validation = validateContent(await readAllContent());
const issues = [...validation.issues, ...(requireCoverage ? releaseCoverageIssues(validation.entries) : [])];

if (issues.length === 0) {
  console.log(`Contenido válido: ${validation.entries.length} entradas.`);
} else {
  for (const issue of issues) {
    const prefix = issue.severity === "error" ? "ERROR" : "AVISO";
    console.log(`${prefix} [${issue.code}]${issue.entryId ? ` ${issue.entryId}` : ""}: ${issue.message}`);
  }
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.length - errors;
  console.log(`\n${validation.entries.length} entradas · ${errors} errores · ${warnings} avisos.`);
  if (errors > 0) process.exitCode = 1;
}
