import { describe, expect, it } from "vitest";
import { analyzeCoverage } from "../../shared/generator/coverage.js";
import { entriesForLetter } from "./generator-fixture.js";

describe("analyzeCoverage", () => {
  it("calcula capacidad por letra considerando cuatro distractores", () => {
    const report = analyzeCoverage(entriesForLetter("A", 8), "general", "intermedio", 4, 4);
    const a = report.cells.find((cell) => cell.letter === "A");
    const b = report.cells.find((cell) => cell.letter === "B");

    expect(a).toMatchObject({ candidates: 8, startsWith: 8, supportsPlayers: 4, ready: true });
    expect(b).toMatchObject({ candidates: 0, supportsPlayers: 0, ready: false });
    expect(report.ready).toBe(false);
  });
});

