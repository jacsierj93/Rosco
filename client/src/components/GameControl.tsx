import { useEffect, useRef, useState } from "react";
import type { ControlView } from "../../../shared/domain/control-view.js";

const EMERGENCY_HOLD_MS = 900;

export function GameControl({
  view,
  busy,
  displayConnected,
  send,
  onExit
}: {
  view: ControlView;
  busy: boolean;
  displayConnected: boolean;
  send: (intent: Record<string, unknown>) => void;
  onExit: () => void;
}) {
  const nextSequence = view.sequence + 1;
  const emergencyTimer = useRef<number | null>(null);
  const [armingEmergency, setArmingEmergency] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportedQuestion, setReportedQuestion] = useState<string | null>(null);

  const cancelEmergency = () => {
    if (emergencyTimer.current !== null) window.clearTimeout(emergencyTimer.current);
    emergencyTimer.current = null;
    setArmingEmergency(false);
  };

  const armEmergency = () => {
    if (busy || emergencyTimer.current !== null) return;
    setArmingEmergency(true);
    emergencyTimer.current = window.setTimeout(() => {
      emergencyTimer.current = null;
      setArmingEmergency(false);
      send({ type: "EMERGENCY_PAUSE", sequence: nextSequence });
    }, EMERGENCY_HOLD_MS);
  };

  useEffect(() => cancelEmergency, [view.phase]);

  return (
    <main className="mobile game-control">
      {!displayConnected && <div className="mobile-disconnected" role="alert">TV desconectada · Esperando reconexión</div>}
      <header className="control-status" aria-live="polite">
        <div><small>Jugador</small><strong>{view.player?.name ?? "—"}</strong></div>
        <div><small>Letra</small><strong>{view.letter ?? "—"}</strong></div>
      </header>

      {view.canStart && <section className="control-ready"><p>Todo listo en la TV</p><button disabled={busy} className="start-turn" onClick={() => send({ type: "START_TURN", sequence: nextSequence })}>Iniciar turno</button></section>}

      {view.phase === "turn_active" && <section className="answer-grid">
        <div className="control-answer"><small>Respuesta correcta</small><strong>{view.answer}</strong></div>
        <button disabled={busy} className="mark-correct" onClick={() => send({ type: "MARK_ANSWER", result: "correct", sequence: nextSequence })}>Correcto</button>
        <button disabled={busy} className="mark-incorrect" onClick={() => send({ type: "MARK_ANSWER", result: "incorrect", sequence: nextSequence })}>Incorrecto</button>
        <button disabled={busy} className="answer-grid__other" onClick={() => send({ type: "ANSWER_NOT_LISTED", sequence: nextSequence })}>Revisión</button>
        <button disabled={busy} className="pass-button" onClick={() => send({ type: "PASS", sequence: nextSequence })}>Pasapalabra</button>
        {view.canRepeatClue && <button disabled={busy} className="repeat-clue-button" onClick={() => send({ type: "REPEAT_CLUE", sequence: nextSequence })}>🔊 Repetir pregunta</button>}
        {reportedQuestion === `${view.gameId}:${view.letter}`
          ? <p className="report-confirmation" role="status">Marcada para revisión editorial ✓</p>
          : <button disabled={busy} className="report-content-button" onClick={() => setShowReport((current) => !current)}>⚑ Marcar palabra o pista</button>}
        {showReport && <div className="report-content-menu">
          <p>¿Qué deberíamos revisar?</p>
          <button disabled={busy} onClick={() => { send({ type: "REPORT_CONTENT", reason: "word_difficult", sequence: nextSequence }); setReportedQuestion(`${view.gameId}:${view.letter}`); setShowReport(false); }}>Palabra demasiado difícil</button>
          <button disabled={busy} onClick={() => { send({ type: "REPORT_CONTENT", reason: "clue_problem", sequence: nextSequence }); setReportedQuestion(`${view.gameId}:${view.letter}`); setShowReport(false); }}>Pista confusa o errónea</button>
        </div>}
      </section>}

      {view.phase === "revealing_error" && <section className="control-wait" role="status" aria-live="polite"><div className="loader" aria-hidden="true" /><p>Mostrando la respuesta correcta…</p></section>}
      {view.canResume && <section className="control-ready"><p>La partida está pausada</p><button disabled={busy} className="start-turn" onClick={() => send({ type: "RESUME", sequence: nextSequence })}>Reanudar</button></section>}
      {view.phase === "reviewing" && view.review && <section className="review-control"><p className="eyebrow">Revisar respuesta</p><h2>{view.review.playerName} · {view.review.letter}</h2>{view.review.selectedLabel && <p>Se registró: <strong>{view.review.selectedLabel}</strong></p>}<p>Respuesta del banco: <strong>{view.review.answer}</strong></p><div><button disabled={busy} className="review-wrong" onClick={() => send({ type: "RESOLVE_REVIEW", playerId: view.review?.playerId, questionId: view.review?.questionId, result: "incorrect", sequence: nextSequence })}>Incorrecta</button><button disabled={busy} className="review-correct" onClick={() => send({ type: "RESOLVE_REVIEW", playerId: view.review?.playerId, questionId: view.review?.questionId, result: "correct", sequence: nextSequence })}>Correcta</button></div></section>}
      {view.phase === "finished" && <section className="control-ready"><div className="success-mark">✓</div><h1>Partida terminada</h1><p>Los resultados están en la TV.</p><button disabled={busy} className="button button--primary button--full" onClick={() => send({ type: "REMATCH", sequence: nextSequence })}>Jugar revancha</button></section>}

      {view.canEmergencyPause && <button
        disabled={busy}
        className={`emergency-button ${armingEmergency ? "is-arming" : ""}`}
        aria-label="Pausa de emergencia; mantener presionado"
        onPointerDown={armEmergency}
        onPointerUp={cancelEmergency}
        onPointerCancel={cancelEmergency}
        onPointerLeave={cancelEmergency}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            armEmergency();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === "Enter" || event.key === " ") cancelEmergency();
        }}
      >{armingEmergency ? "Mantené presionado…" : "Pausa de emergencia"}</button>}
      {view.canUndo && <button disabled={busy} className="undo-button" onClick={() => send({ type: "UNDO", sequence: nextSequence })}>↶ Deshacer última respuesta</button>}
      <button disabled={busy} className="exit-game-button" onClick={onExit}>Salir al menú</button>
    </main>
  );
}
