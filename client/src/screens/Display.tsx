import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createControlView } from "../../../shared/domain/control-view.js";
import { prepareGameForRecovery } from "../../../shared/domain/recovery.js";
import { reduceGame } from "../../../shared/domain/reducer.js";
import { ROSCO_LETTERS, type GameAction, type GameState } from "../../../shared/domain/types.js";
import { generateRoscos } from "../../../shared/generator/generate.js";
import { recordGameUsage } from "../../../shared/generator/history.js";
import type { UsageHistory } from "../../../shared/generator/types.js";
import type { GameConfig } from "../../../shared/validation/schemas.js";
import { Brand } from "../components/Brand.js";
import { GameDisplay } from "../components/GameDisplay.js";
import { contentForMode } from "../lib/game-content.js";
import { loadVoiceName, playFeedback, saveVoiceName, spanishVoices, speakClue, speakText, stopSpeaking } from "../lib/audio.js";
import { emitWithAck, getSocket } from "../lib/socket.js";
import {
  clearActiveGame,
  clearDisplaySession,
  exportHistoryFile,
  importHistoryFile,
  loadActiveGame,
  loadDisplaySession,
  loadHistory,
  saveActiveGame,
  saveDisplaySession,
  saveContentFeedback,
  saveHistory,
  type DisplaySession
} from "../lib/storage.js";

type ServerResponse = { ok: true; data: DisplaySession } | { ok: false; error: string };
type DisplayStatus = "connecting" | "waiting" | "configured" | "error";
type ExtendedIntent = GameAction
  | { type: "UNDO"; sequence: number }
  | { type: "REMATCH"; sequence: number }
  | { type: "EXIT_TO_MENU"; sequence: number };

function createGame(config: GameConfig, history: UsageHistory, gameNumber: number): {
  game: GameState;
  selectedEntryIds: string[];
} {
  const generated = generateRoscos({
    config,
    entries: contentForMode(config.mode),
    history,
    gameNumber,
    seed: `game-${gameNumber}-${Date.now()}`,
    letters: ROSCO_LETTERS
  });
  return {
    game: {
      id: `game-${gameNumber}-${Date.now()}`,
      mode: config.mode,
      difficulty: config.difficulty,
      speechEnabled: config.speechEnabled,
      soundEffectsEnabled: config.soundEffectsEnabled,
      phase: "ready",
      sequence: 0,
      players: generated.players,
      currentPlayerIndex: 0,
      activeClock: null,
      revealUntilMs: null,
      reviews: [],
      pausedFrom: null
    },
    selectedEntryIds: generated.selectedEntryIds
  };
}

export function Display() {
  const [session, setSession] = useState<DisplaySession | null>(null);
  const [status, setStatus] = useState<DisplayStatus>("connecting");
  const [controlConnected, setControlConnected] = useState(false);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [gameNumber, setGameNumber] = useState(0);
  const [history, setHistory] = useState<UsageHistory>(() => loadHistory());
  const [nowMs, setNowMs] = useState(() => performance.now());
  const [error, setError] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState(() => loadVoiceName());
  const [speechReady, setSpeechReady] = useState(false);
  const undoStack = useRef<GameState[]>([]);
  const sessionRef = useRef<DisplaySession | null>(null);
  const configRef = useRef<GameConfig | null>(null);
  const historyRef = useRef(history);
  const gameNumberRef = useRef(0);
  const pendingSelectedEntries = useRef<string[]>([]);
  const voiceNameRef = useRef(voiceName);
  const speechReadyRef = useRef(false);

  const updateHistory = (next: UsageHistory) => {
    historyRef.current = next;
    setHistory(next);
    saveHistory(next);
  };

  const beginGame = (nextConfig: GameConfig, nextNumber: number) => {
    const created = createGame(nextConfig, historyRef.current, nextNumber);
    configRef.current = nextConfig;
    gameNumberRef.current = nextNumber;
    undoStack.current = [];
    setConfig(nextConfig);
    setGameNumber(nextNumber);
    setGame(created.game);
    pendingSelectedEntries.current = created.selectedEntryIds;
    setStatus("configured");
  };

  useEffect(() => {
    const persisted = loadActiveGame();
    if (persisted) {
      const recovered = prepareGameForRecovery(persisted.game, performance.now());
      recovered.speechEnabled ??= persisted.config.speechEnabled ?? true;
      recovered.soundEffectsEnabled ??= persisted.config.soundEffectsEnabled ?? true;
      configRef.current = persisted.config;
      gameNumberRef.current = persisted.gameNumber;
      setConfig(persisted.config);
      setGameNumber(persisted.gameNumber);
      setGame(recovered);
      pendingSelectedEntries.current = persisted.pendingSelectedEntryIds ?? [];
    }

    const socket = getSocket();
    const onPeer = (payload: { controlConnected?: boolean }) => {
      if (typeof payload.controlConnected !== "boolean") return;
      setControlConnected(payload.controlConnected);
      if (payload.controlConnected) {
        setGame((current) => current ? structuredClone(current) : current);
        return;
      }
      if (!payload.controlConnected) {
        setGame((current) => {
          if (!current || current.phase !== "turn_active") return current;
          undoStack.current.push(structuredClone(current));
          try {
            return reduceGame(current, { type: "EMERGENCY_PAUSE", sequence: current.sequence + 1 }, performance.now());
          } catch {
            return current;
          }
        });
      }
    };
    const onConfiguration = (payload: unknown) => {
      const candidate = payload as { config?: GameConfig };
      if (candidate.config) beginGame(candidate.config, gameNumberRef.current + 1);
    };
    const onIntent = (payload: unknown) => {
      const intent = payload as ExtendedIntent;
      setGame((current) => {
        if (!current || intent.sequence !== current.sequence + 1) return current;
        if (current.soundEffectsEnabled && speechReadyRef.current) {
          const type = intent.type;
          if (type === "START_TURN" || type === "RESUME") playFeedback("start");
          else if (type === "MARK_ANSWER") playFeedback(intent.result === "correct" ? "correct" : "incorrect");
          else if (type === "RESOLVE_REVIEW") playFeedback(intent.result === "correct" ? "correct" : "incorrect");
          else if (type === "ANSWER_NOT_LISTED" || type === "REPORT_CONTENT") playFeedback("review");
          else if (type === "PASS") playFeedback("pass");
          else if (type === "EMERGENCY_PAUSE") playFeedback("pause");
          else if (type === "REPEAT_CLUE") playFeedback("repeat");
        }
        if (intent.type === "EXIT_TO_MENU") {
          window.setTimeout(() => newGame(), 0);
          return current;
        }
        if (intent.type === "UNDO") {
          const previous = undoStack.current.pop();
          if (!previous) return current;
          const recovered = prepareGameForRecovery(previous, performance.now());
          recovered.sequence = intent.sequence;
          return recovered;
        }
        if (intent.type === "REMATCH") {
          if (current.phase !== "finished" || !configRef.current) return current;
          window.setTimeout(() => beginGame(configRef.current as GameConfig, gameNumberRef.current + 1), 0);
          return current;
        }
        if (intent.type === "START_TURN" && current.phase === "ready" && pendingSelectedEntries.current.length > 0) {
          const committedHistory = recordGameUsage(
            historyRef.current,
            pendingSelectedEntries.current,
            gameNumberRef.current
          );
          historyRef.current = committedHistory;
          saveHistory(committedHistory);
          window.setTimeout(() => setHistory(committedHistory), 0);
          pendingSelectedEntries.current = [];
        }
        if (intent.type === "REPORT_CONTENT" && current.phase === "turn_active") {
          const player = current.players[current.currentPlayerIndex];
          const question = player?.questions[player.cursor];
          if (question) saveContentFeedback({
            questionId: question.id,
            answer: question.answer,
            clue: question.clue,
            mode: current.mode,
            difficulty: current.difficulty,
            reason: intent.reason,
            source: question.source,
            reportedAt: new Date().toISOString()
          });
        }
        if (intent.type === "REPEAT_CLUE" && current.phase === "turn_active" && current.speechEnabled && speechReadyRef.current) {
          const player = current.players[current.currentPlayerIndex];
          const question = player?.questions[player.cursor];
          if (question) window.setTimeout(() => speakClue(question.clue, question.letter, question.relation, current.difficulty, voiceNameRef.current), 0);
        }
        if (["MARK_ANSWER", "SELECT_OPTION", "ANSWER_NOT_LISTED", "PASS"].includes(intent.type)) {
          undoStack.current.push(structuredClone(current));
          if (undoStack.current.length > 20) undoStack.current.shift();
        }
        try {
          return reduceGame(current, intent, performance.now());
        } catch {
          return current;
        }
      });
    };
    socket.on("room:peer-status", onPeer);
    socket.on("control:configuration", onConfiguration);
    socket.on("control:intent", onIntent);

    const connect = async () => {
      try {
        const stored = loadDisplaySession();
        const response = stored
          ? await emitWithAck<ServerResponse>("room:resume-display", {
              credential: stored.recoveryCredential,
              controlToken: stored.controlToken
            })
          : await emitWithAck<ServerResponse>("room:create");
        if (!response.ok) throw new Error(response.error);
        saveDisplaySession(response.data);
        sessionRef.current = response.data;
        setSession(response.data);
        setStatus(persisted ? "configured" : "waiting");
      } catch {
        setError("No pudimos preparar la sala. Revisá la conexión e intentá nuevamente.");
        setStatus("error");
      }
    };
    void connect();

    return () => {
      socket.off("room:peer-status", onPeer);
      socket.off("control:configuration", onConfiguration);
      socket.off("control:intent", onIntent);
    };
  }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const refresh = () => setVoices(spanishVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  useEffect(() => {
    voiceNameRef.current = voiceName;
    saveVoiceName(voiceName);
  }, [voiceName]);

  useEffect(() => {
    speechReadyRef.current = speechReady;
  }, [speechReady]);

  useEffect(() => {
    if (!game || game.phase !== "turn_active" || !game.speechEnabled || !speechReady) {
      stopSpeaking();
      return;
    }
    const player = game.players[game.currentPlayerIndex];
    const question = player?.questions[player.cursor];
    if (!question) return;
    speakClue(question.clue, question.letter, question.relation, game.difficulty, voiceName);
    return stopSpeaking;
  }, [game?.phase, game?.currentPlayerIndex, game?.players[game?.currentPlayerIndex ?? 0]?.cursor, game?.speechEnabled, speechReady, voiceName]);

  useEffect(() => {
    if (!session || !game) return;
    const view = createControlView(game, { canUndo: undoStack.current.length > 0 });
    getSocket().emit("display:state", { roomId: session.roomId, view }, () => undefined);
    if (config) saveActiveGame({
      game: prepareGameForRecovery(game, performance.now()),
      config,
      gameNumber,
      pendingSelectedEntryIds: pendingSelectedEntries.current
    });
  }, [session, game, config, gameNumber]);

  useEffect(() => {
    if (!game || game.phase !== "turn_active") return;
    const timer = window.setInterval(() => {
      const currentNow = performance.now();
      setNowMs(currentNow);
      setGame((current) => {
        if (!current?.activeClock || current.phase !== "turn_active") return current;
        const player = current.players[current.currentPlayerIndex];
        if (!player || player.remainingMs - (currentNow - current.activeClock.startedAtMs) > 0) return current;
        try {
          return reduceGame(current, { type: "TIME_EXPIRED", sequence: current.sequence + 1 }, currentNow);
        } catch {
          return current;
        }
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [game?.phase, game?.activeClock?.startedAtMs]);

  useEffect(() => {
    if (!game || game.phase !== "revealing_error" || game.revealUntilMs === null) return;
    const timer = window.setTimeout(() => {
      setGame((current) => {
        if (!current || current.phase !== "revealing_error") return current;
        try {
          return reduceGame(current, { type: "FINISH_REVEAL", sequence: current.sequence + 1 }, performance.now());
        } catch {
          return current;
        }
      });
    }, Math.max(0, game.revealUntilMs - performance.now()));
    return () => window.clearTimeout(timer);
  }, [game?.phase, game?.revealUntilMs]);

  useEffect(() => {
    const persistBeforeExit = () => {
      if (game && config) saveActiveGame({
        game: prepareGameForRecovery(game, performance.now()),
        config,
        gameNumber,
        pendingSelectedEntryIds: pendingSelectedEntries.current
      });
    };
    window.addEventListener("beforeunload", persistBeforeExit);
    return () => window.removeEventListener("beforeunload", persistBeforeExit);
  }, [game, config, gameNumber]);

  const controlUrl = useMemo(() => {
    if (!session) return "";
    const url = new URL(`/control/${session.code}`, window.location.origin);
    url.searchParams.set("token", session.controlToken);
    return url.toString();
  }, [session]);

  const restart = () => {
    clearDisplaySession();
    window.location.reload();
  };

  const newGame = () => {
    stopSpeaking();
    clearActiveGame();
    const activeSession = sessionRef.current;
    if (activeSession) getSocket().emit("display:reset", { roomId: activeSession.roomId }, () => undefined);
    setGame(null);
    setConfig(null);
    configRef.current = null;
    undoStack.current = [];
    pendingSelectedEntries.current = [];
    setStatus("waiting");
  };

  const confirmNewGame = () => {
    if (window.confirm("¿Salir de la partida y volver al menú inicial?")) newGame();
  };

  if (status === "connecting") return <main className="display display--center" role="status" aria-live="polite"><div className="loader" aria-hidden="true" /><h1>Preparando la sala…</h1><p>Render puede tardar un momento en despertar.</p></main>;
  if (status === "error") return <main className="display display--center"><Brand /><h1>No pudimos conectar</h1><p>{error}</p><button className="button button--primary" onClick={restart}>Intentar nuevamente</button></main>;
  if (config && game && status === "configured") {
    return <><GameDisplay state={game} nowMs={nowMs} controlConnected={controlConnected} onExport={() => exportHistoryFile(history)} onNewGame={newGame} onExit={confirmNewGame} />{(game.speechEnabled || game.soundEffectsEnabled) && !speechReady && <button className="speech-unlock" onClick={() => { setSpeechReady(true); speechReadyRef.current = true; if (game.soundEffectsEnabled) playFeedback("start"); if (game.speechEnabled) speakText("Audio activado.", 0.92, voiceName); }}>🔊 Activar audio</button>}</>;
  }

  return (
    <main className="display display--pairing">
      <header className="display__header"><Brand compact /><span className={`connection-dot ${controlConnected ? "connection-dot--on" : ""}`} role="status" aria-live="polite">{controlConnected ? "Control conectado" : "Esperando control"}</span></header>
      <section className="pairing">
        <div><p className="eyebrow">Conectá el teléfono</p><h1>Escaneá y<br />tomá el control.</h1><p className="pairing__help">Desde el celular vas a configurar jugadores, tiempo y tipo de rosco.</p><div className="room-code"><small>Código de sala</small><strong>{session?.code}</strong></div></div>
        {controlUrl && <div className="qr-card"><QRCodeSVG value={controlUrl} size={260} level="M" /><span>Escaneá con la cámara</span></div>}
      </section>
      {error && <div className="pairing-error alert" role="alert">{error}</div>}
      <aside className="speech-settings" aria-label="Configuración de voz">
        {voices.length > 0 && <label>Voz<select value={voiceName} onChange={(event) => setVoiceName(event.target.value)}><option value="">Automática</option>{voices.map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} · {voice.lang}</option>)}</select></label>}
        <button onClick={() => { setSpeechReady(true); speechReadyRef.current = true; playFeedback("start"); speakText("Audio activado. Las preguntas se leerán en voz alta.", 0.92, voiceName); }}>{speechReady ? "✓ Audio activado" : "🔊 Activar y probar audio"}</button>
      </aside>
      <aside className="history-tools"><button onClick={() => exportHistoryFile(history)}>Exportar historial</button><label>Importar historial<input type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importHistoryFile(file).then(updateHistory).catch(() => setError("El archivo de historial no es válido.")); }} /></label></aside>
    </main>
  );
}
