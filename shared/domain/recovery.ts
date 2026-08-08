import type { GameState } from "./types.js";

function available(player: GameState["players"][number]): boolean {
  return player.remainingMs > 0 && player.questions.some((question) => question.status === "pending");
}

export function prepareGameForRecovery(state: GameState, nowMs: number): GameState {
  const recovered = structuredClone(state);
  const player = recovered.players[recovered.currentPlayerIndex];

  if (recovered.phase === "turn_active" && recovered.activeClock && player) {
    player.remainingMs = Math.max(0, player.remainingMs - Math.max(0, nowMs - recovered.activeClock.startedAtMs));
    recovered.activeClock = null;
    recovered.phase = "paused";
    recovered.pausedFrom = "turn_active";
  } else if (recovered.phase === "revealing_error") {
    recovered.activeClock = null;
    recovered.revealUntilMs = null;
    const total = recovered.players.length;
    for (let offset = 1; offset <= total; offset += 1) {
      const index = (recovered.currentPlayerIndex + offset) % total;
      const candidate = recovered.players[index];
      if (candidate && available(candidate)) {
        recovered.currentPlayerIndex = index;
        recovered.phase = "between_turns";
        recovered.pausedFrom = null;
        return recovered;
      }
    }
    recovered.phase = recovered.reviews.length > 0 ? "reviewing" : "finished";
  }

  return recovered;
}
