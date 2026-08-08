import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ControlView } from "../../../shared/domain/control-view.js";
import { gameConfigSchema, type GameConfig } from "../../../shared/validation/schemas.js";
import { Brand } from "../components/Brand.js";
import { GameControl } from "../components/GameControl.js";
import { createClientId } from "../lib/id.js";
import { emitWithAck, getSocket } from "../lib/socket.js";

type JoinStatus = "joining" | "manual" | "configuring" | "sent" | "error";

interface PlayerInput { id: string; name: string }

function pathCode(): string {
  const match = window.location.pathname.match(/^\/control\/([A-Z2-9]{6})$/i);
  return match?.[1]?.toUpperCase() ?? "";
}

export function Control() {
  const initialCode = pathCode();
  const initialToken = new URLSearchParams(window.location.search).get("token") ?? "";
  const [status, setStatus] = useState<JoinStatus>(initialCode && initialToken ? "joining" : "manual");
  const [roomId, setRoomId] = useState("");
  const [code, setCode] = useState(initialCode);
  const [token, setToken] = useState(initialToken);
  const [mode, setMode] = useState<GameConfig["mode"]>("general");
  const [difficulty, setDifficulty] = useState<GameConfig["difficulty"]>("intermedio");
  const [duration, setDuration] = useState(120);
  const [regionalWeight, setRegionalWeight] = useState(0.3);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);
  const [players, setPlayers] = useState<PlayerInput[]>([{ id: createClientId(), name: "" }]);
  const [error, setError] = useState("");
  const [view, setView] = useState<ControlView | null>(null);
  const [busy, setBusy] = useState(false);
  const [displayConnected, setDisplayConnected] = useState(true);
  const hasJoined = useRef(false);
  const viewRef = useRef<ControlView | null>(null);

  const join = async (roomCode: string, roomToken: string) => {
    setStatus("joining");
    setError("");
    try {
      const response = await emitWithAck<{ ok: true; data: { roomId: string } } | { ok: false; error: string }>(
        "room:join-control",
        { code: roomCode, token: roomToken }
      );
      if (!response.ok) throw new Error(response.error);
      hasJoined.current = true;
      setDisplayConnected(true);
      setRoomId(response.data.roomId);
      setStatus(viewRef.current ? "sent" : "configuring");
    } catch {
      setError("No pudimos vincular el control. Volvé a escanear el QR de la TV.");
      setStatus("error");
    }
  };

  useEffect(() => {
    const socket = getSocket();
    const onState = (nextView: ControlView) => {
      viewRef.current = nextView;
      setView(nextView);
      setStatus("sent");
    };
    const onConnect = () => {
      if (hasJoined.current && code && token) void join(code, token);
    };
    const onPeer = (payload: { displayConnected?: boolean }) => {
      if (typeof payload.displayConnected === "boolean") setDisplayConnected(payload.displayConnected);
    };
    const onReset = () => {
      viewRef.current = null;
      setView(null);
      setStatus("configuring");
    };
    socket.on("display:state", onState);
    socket.on("connect", onConnect);
    socket.on("display:reset", onReset);
    socket.on("room:peer-status", onPeer);
    socket.on("disconnect", () => setDisplayConnected(false));
    if (initialCode && initialToken) void join(initialCode, initialToken);
    return () => {
      socket.off("display:state", onState);
      socket.off("connect", onConnect);
      socket.off("display:reset", onReset);
      socket.off("room:peer-status", onPeer);
    };
  }, []);

  const canAddPlayer = players.length < 4;
  const validNames = useMemo(() => players.every((player) => player.name.trim().length > 0), [players]);

  const submitManual = (event: FormEvent) => {
    event.preventDefault();
    void join(code.trim().toUpperCase(), token.trim());
  };

  const submitConfig = async (event: FormEvent) => {
    event.preventDefault();
    const candidate = {
      mode,
      difficulty,
      durationSeconds: duration,
      regionalWeight: mode === "general" ? regionalWeight : 0,
      speechEnabled,
      soundEffectsEnabled,
      players: players.map((player) => ({ ...player, name: player.name.trim() }))
    };
    const parsed = gameConfigSchema.safeParse(candidate);
    if (!parsed.success) {
      setError("Revisá los nombres y valores de la partida.");
      return;
    }
    try {
      const response = await emitWithAck<{ ok: boolean; error?: string }>("control:configuration", {
        roomId,
        config: parsed.data
      });
      if (!response.ok) throw new Error(response.error);
      setStatus("sent");
    } catch {
      setError("La configuración no llegó a la TV. Revisá que siga conectada.");
    }
  };

  const sendIntent = async (intent: Record<string, unknown>) => {
    if (!roomId || busy) return;
    setBusy(true);
    try {
      const response = await emitWithAck<{ ok: boolean; error?: string }>("control:intent", { roomId, intent });
      if (!response.ok) throw new Error(response.error);
    } catch {
      setError("La acción no llegó a la TV.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "joining") {
    return <main className="mobile mobile--center" role="status" aria-live="polite"><div className="loader" aria-hidden="true" /><h1>Conectando con la TV…</h1></main>;
  }

  if (status === "sent" && view) return <GameControl
    view={view}
    busy={busy || !displayConnected}
    displayConnected={displayConnected}
    send={(intent) => void sendIntent(intent)}
    onExit={() => {
      if (window.confirm("¿Salir de la partida y volver a la configuración?")) {
        void sendIntent({ type: "EXIT_TO_MENU", sequence: view.sequence + 1 });
      }
    }}
  />;

  if (status === "sent") {
    return <main className="mobile mobile--center"><div className="success-mark">✓</div><h1>Partida preparada</h1><p>Revisá el resumen en la TV. La botonera aparecerá cuando comience el juego.</p></main>;
  }

  if (status === "manual" || status === "error") {
    return (
      <main className="mobile mobile--center">
        <Brand />
        <h1>Vincular control</h1>
        <p>Lo más sencillo es escanear el QR que aparece en la TV.</p>
        {error && <div className="alert" role="alert">{error}</div>}
        <form className="mobile-form" onSubmit={submitManual}>
          <label>Código de sala<input value={code} onChange={(event) => setCode(event.target.value)} maxLength={6} autoCapitalize="characters" /></label>
          <label>Token de acceso<input value={token} onChange={(event) => setToken(event.target.value)} /></label>
          <button className="button button--primary" type="submit">Conectar</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mobile config-screen">
      <header className="mobile__header"><Brand compact /><span className="connection-dot connection-dot--on" role="status" aria-live="polite">TV conectada</span></header>
      <form onSubmit={submitConfig}>
        <p className="eyebrow">Nueva partida</p>
        <h1>Armemos el rosco.</h1>

        <fieldset className="segmented-field"><legend>Tipo de rosco</legend><div className="segmented">
          <button type="button" className={mode === "general" ? "is-active" : ""} onClick={() => setMode("general")}>General</button>
          <button type="button" className={mode === "teocratico" ? "is-active" : ""} onClick={() => setMode("teocratico")}>Teocrático</button>
        </div></fieldset>

        <fieldset className="segmented-field"><legend>Dificultad</legend><div className="segmented segmented--four">
          {(["infantil", "facil", "intermedio", "avanzado"] as const).map((value) => <button key={value} type="button" className={difficulty === value ? "is-active" : ""} onClick={() => setDifficulty(value)}>{value === "infantil" ? "Niños" : value}</button>)}
        </div></fieldset>

        <label className="range-field"><span>Tiempo por jugador <strong>{duration} s</strong></span><input type="range" min="30" max="300" step="15" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>

        {mode === "general" && <label className="range-field"><span>Preferencia rioplatense <strong>{Math.round(regionalWeight * 100)}%</strong></span><input type="range" min="0" max="0.5" step="0.1" value={regionalWeight} onChange={(event) => setRegionalWeight(Number(event.target.value))} /></label>}

        <fieldset className="audio-config"><legend>Audio</legend>
          <label className="checkbox-field"><input type="checkbox" checked={speechEnabled} onChange={(event) => setSpeechEnabled(event.target.checked)} /><span><strong>Leer preguntas en voz alta</strong><small>La voz se escucha en la TV.</small></span></label>
          <label className="checkbox-field"><input type="checkbox" checked={soundEffectsEnabled} onChange={(event) => setSoundEffectsEnabled(event.target.checked)} /><span><strong>Sonidos de las acciones</strong><small>Confirmaciones breves en la TV.</small></span></label>
        </fieldset>

        <fieldset className="players-field"><legend>Jugadores</legend>
          {players.map((player, index) => <div className="player-input" key={player.id}><span>{index + 1}</span><input aria-label={`Nombre del jugador ${index + 1}`} placeholder="Nombre" maxLength={30} value={player.name} onChange={(event) => setPlayers((current) => current.map((item) => item.id === player.id ? { ...item, name: event.target.value } : item))} />{players.length > 1 && <button type="button" aria-label={`Eliminar jugador ${index + 1}`} onClick={() => setPlayers((current) => current.filter((item) => item.id !== player.id))}>×</button>}</div>)}
          {canAddPlayer && <button className="add-player" type="button" onClick={() => setPlayers((current) => [...current, { id: createClientId(), name: "" }])}>+ Agregar jugador</button>}
        </fieldset>

        {error && <div className="alert" role="alert">{error}</div>}
        <button className="button button--primary button--full" type="submit" disabled={!validNames}>Preparar partida</button>
      </form>
    </main>
  );
}
