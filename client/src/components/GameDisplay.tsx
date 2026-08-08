import { ROSCO_LETTERS, type GameState } from "../../../shared/domain/types.js";
import { calculateResults } from "../../../shared/domain/results.js";

function remainingTime(state: GameState, nowMs: number): number {
  const player = state.players[state.currentPlayerIndex];
  if (!player) return 0;
  if (!state.activeClock) return player.remainingMs;
  return Math.max(0, player.remainingMs - Math.max(0, nowMs - state.activeClock.startedAtMs));
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.ceil(milliseconds / 1_000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "pendiente",
  correct: "correcta",
  incorrect: "incorrecta",
  in_review: "en revisión",
  unanswered: "sin responder"
};

function resultStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function GameDisplay({
  state,
  nowMs,
  controlConnected,
  onExport,
  onNewGame,
  onExit
}: {
  state: GameState;
  nowMs: number;
  controlConnected: boolean;
  onExport: () => void;
  onNewGame: () => void;
  onExit: () => void;
}) {
  const player = state.players[state.currentPlayerIndex];
  const question = player?.questions[player.cursor];
  const showQuestion = state.phase === "turn_active";
  const revealing = state.phase === "revealing_error";
  const finished = state.phase === "finished";
  const results = calculateResults(state);
  const review = state.reviews[0];
  const reviewPlayer = review ? state.players.find((candidate) => candidate.id === review.playerId) : undefined;
  const reviewQuestion = review ? reviewPlayer?.questions.find((candidate) => candidate.id === review.questionId) : undefined;

  if (!player) return null;

  return (
    <main className={`game-display ${finished ? "game-display--results" : ""}`}>
      {!controlConnected && <div className="disconnect-banner" role="alert">Control desconectado · La partida fue pausada</div>}
      <header className="game-topbar">
        <div><small>Turno de</small><strong>{player.name}</strong></div>
        <div className={`game-clock ${remainingTime(state, nowMs) <= 10_000 ? "game-clock--danger" : ""}`} role="timer" aria-label={`Tiempo restante: ${formatTime(remainingTime(state, nowMs))}`}>
          {formatTime(remainingTime(state, nowMs))}
        </div>
        <div><small>Aciertos</small><strong>{player.questions.filter((item) => item.status === "correct").length}</strong></div>
        <button className="display-exit-button" onClick={onExit}>Salir al menú</button>
      </header>

      <section className="game-stage">
        <div className="rosco" role="list" aria-label={`Estado del rosco de ${player.name}`}>
          {ROSCO_LETTERS.map((letter, index) => {
            const item = player.questions[index];
            const status = item?.status ?? "pending";
            const current = index === player.cursor && !finished;
            return <span key={letter} role="listitem" aria-current={current ? "step" : undefined} aria-label={`${letter}: ${STATUS_LABELS[status] ?? status}${current ? ", actual" : ""}`} className={`rosco__letter rosco__letter--${status} ${current ? "is-current" : ""}`} style={{ "--index": index } as React.CSSProperties}>{letter}</span>;
          })}
          <div className="rosco__center">
            {finished ? <><small>Partida</small><strong>Finalizada</strong></> : <><small>{question?.relation === "contiene" ? "Contiene" : "Empieza con"}</small><strong>{question?.letter}</strong></>}
          </div>
        </div>

        <div className="clue-panel">
          {showQuestion && question && <><p className="eyebrow">{question.relation === "contiene" ? "Contiene" : "Empieza con"} {question.letter}</p><h1>{question.clue}</h1></>}
          {revealing && question && <div className="answer-reveal"><p>Respuesta correcta</p><strong>{question.answer}</strong></div>}
          {(state.phase === "ready" || state.phase === "between_turns") && <><p className="eyebrow">Próximo turno</p><h1>{player.name}</h1><p className="clue-panel__hint">La pregunta aparecerá cuando el conductor inicie el reloj.</p></>}
          {state.phase === "paused" && <><p className="eyebrow">Partida pausada</p><h1>La pregunta está oculta.</h1></>}
          {state.phase === "reviewing" && reviewQuestion && <><p className="eyebrow">Revisión · {reviewPlayer?.name} · {reviewQuestion.letter}</p><h1>{reviewQuestion.clue}</h1><div className="review-answer"><small>Respuesta del banco</small><strong>{reviewQuestion.answer}</strong><span>El conductor debe confirmar desde el teléfono.</span></div></>}
          {finished && <div className="results-panel">
            <p className="eyebrow">Resultado final</p><h1>{results[0]?.name}</h1><p className="winner-copy">{results.length > 1 ? "ganó la partida" : "completó la partida"}</p>
            <div className="results-table">{results.map((result) => <div key={result.playerId}><b>{result.position}</b><strong>{result.name}</strong><span className="result-correct">{result.correct} ✓</span><span>{result.incorrect} ✕</span><span>{formatTime(result.remainingMs)}</span></div>)}</div>
            <section className="results-review" aria-label="Revisión de respuestas">
              <h2>Revisión por letra</h2>
              {results.map((result) => {
                const resultPlayer = state.players.find((candidate) => candidate.id === result.playerId);
                return <details key={result.playerId}>
                  <summary>{result.name}<span>{result.correct} correctas · {result.incorrect} incorrectas · {result.unanswered} sin responder</span></summary>
                  <div className="results-review__questions">{resultPlayer?.questions.map((item) => <article key={item.id}>
                    <b>{item.letter}</b>
                    <div><strong>{item.answer}</strong><span>{resultStatus(item.status)}</span></div>
                    <a href={item.source.url} target="_blank" rel="noreferrer">{item.source.name}<span className="sr-only"> para {item.answer} (abre en otra pestaña)</span></a>
                  </article>)}</div>
                </details>;
              })}
            </section>
            <div className="results-actions"><button onClick={onExport}>Exportar historial</button><button onClick={onNewGame}>Nueva partida</button></div>
          </div>}
        </div>
      </section>
    </main>
  );
}
