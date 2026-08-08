import { ROSCO_LETTERS, type AssignedQuestion, type PlayerState } from "../domain/types.js";
import type { ContentEntry } from "../validation/schemas.js";
import { clueFor, isEligible, isRegional } from "./eligibility.js";
import { GenerationError } from "./errors.js";
import { createRandom, shuffle } from "./random.js";
import type { GenerateRoscosInput, GeneratedRoscos, UsageHistory } from "./types.js";

interface RankedEntry {
  entry: ContentEntry;
  regional: boolean;
  historyScore: number;
  randomScore: number;
}

function historyScore(
  entryId: string,
  history: UsageHistory,
  gameNumber: number,
  cooldownGames: number
): number {
  const usage = history[entryId];
  if (!usage) return Number.MAX_SAFE_INTEGER;
  const distance = gameNumber - usage.lastGameNumber;
  if (distance <= cooldownGames) return distance * 1_000 - usage.useCount - 1_000_000;
  return distance * 1_000 - usage.useCount;
}

function rankCandidates(
  entries: ContentEntry[],
  input: GenerateRoscosInput,
  random: () => number
): RankedEntry[] {
  const cooldownGames = input.cooldownGames ?? 5;
  return entries
    .map((entry): RankedEntry => {
      const score = historyScore(entry.id, input.history, input.gameNumber, cooldownGames);
      return { entry, regional: isRegional(entry), historyScore: score, randomScore: random() };
    })
    .sort((left, right) => {
      if (left.historyScore !== right.historyScore) return right.historyScore - left.historyScore;
      return left.randomScore - right.randomScore;
    });
}

function chooseAnswers(
  ranked: RankedEntry[],
  count: number,
  regionalNeeded: number,
  used: Set<string>
): RankedEntry[] {
  const available = ranked.filter((candidate) => !used.has(candidate.entry.id));
  const regional = available.filter((candidate) => candidate.regional && candidate.historyScore >= 0);
  const general = available.filter((candidate) => !candidate.regional);
  const regionalCount = Math.min(count, regionalNeeded, regional.length);
  const chosen = [...regional.slice(0, regionalCount), ...general.slice(0, count - regionalCount)];

  if (chosen.length < count) {
    const chosenIds = new Set(chosen.map((candidate) => candidate.entry.id));
    chosen.push(...available.filter((candidate) => !chosenIds.has(candidate.entry.id)).slice(0, count - chosen.length));
  }
  return chosen;
}

function optionId(questionId: string, entryId: string): string {
  return `${questionId}:${entryId}`;
}

export function generateRoscos(input: GenerateRoscosInput): GeneratedRoscos {
  const random = createRandom(input.seed);
  const letters = input.letters ?? ROSCO_LETTERS;
  const distractorCount = input.distractorCount ?? 4;
  const eligible = input.entries.filter((entry) =>
    isEligible(entry, input.config.mode, input.config.difficulty)
  );
  const ranked = rankCandidates(eligible, input, random);
  const usedAnswers = new Set<string>();
  const assignments = new Map<string, ContentEntry>();
  const totalAnswers = letters.length * input.config.players.length;
  const regionalTarget = Math.round(totalAnswers * input.config.regionalWeight);
  let regionalSelected = 0;

  for (const letter of shuffle(letters, random)) {
    const letterCandidates = ranked.filter((candidate) => candidate.entry.letter === letter);
    const neededRegional = Math.max(0, regionalTarget - regionalSelected);
    const selected = chooseAnswers(
      letterCandidates,
      input.config.players.length,
      neededRegional,
      usedAnswers
    );

    if (selected.length < input.config.players.length) {
      throw new GenerationError("INSUFFICIENT_ANSWERS", letter, {
        required: input.config.players.length,
        available: selected.length
      });
    }

    shuffle(selected, random).forEach((candidate, playerIndex) => {
      const player = input.config.players[playerIndex];
      if (!player) return;
      assignments.set(`${player.id}:${letter}`, candidate.entry);
      usedAnswers.add(candidate.entry.id);
      if (candidate.regional) regionalSelected += 1;
    });
  }

  const players: PlayerState[] = input.config.players.map((configuredPlayer) => {
    const questions: AssignedQuestion[] = letters.map((letter) => {
      const answerEntry = assignments.get(`${configuredPlayer.id}:${letter}`);
      if (!answerEntry) {
        throw new GenerationError("INSUFFICIENT_ANSWERS", letter, { required: 1, available: 0 });
      }
      const distractorPool = ranked.filter(
        (candidate) =>
          candidate.entry.letter === letter &&
          candidate.entry.relation === answerEntry.relation &&
          !usedAnswers.has(candidate.entry.id)
      );
      const distractors = shuffle(distractorPool, random).slice(0, distractorCount);
      if (distractors.length < distractorCount) {
        throw new GenerationError("INSUFFICIENT_DISTRACTORS", letter, {
          required: distractorCount,
          available: distractors.length,
          relation: answerEntry.relation
        });
      }

      const questionId = `${configuredPlayer.id}:${letter}:${answerEntry.id}`;
      const answerOption = { id: optionId(questionId, answerEntry.id), label: answerEntry.answer };
      const options = shuffle(
        [
          answerOption,
          ...distractors.map(({ entry }) => ({ id: optionId(questionId, entry.id), label: entry.answer }))
        ],
        random
      );

      return {
        id: questionId,
        letter,
        relation: answerEntry.relation,
        clue: clueFor(answerEntry, input.config.difficulty) ?? "",
        answer: answerEntry.answer,
        acceptedVariants: answerEntry.acceptedVariants,
        source: answerEntry.source,
        options,
        correctOptionId: answerOption.id,
        status: "pending"
      };
    });

    return {
      id: configuredPlayer.id,
      name: configuredPlayer.name,
      remainingMs: input.config.durationSeconds * 1_000,
      questions,
      cursor: 0
    };
  });

  return {
    players,
    seed: input.seed,
    selectedEntryIds: [...usedAnswers],
    regionalSelected,
    regionalTarget
  };
}
