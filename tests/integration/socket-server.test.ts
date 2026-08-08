import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";
import { createRoscoServer, type RoscoServer } from "../../server/src/app.js";

const SECRET = "a-secure-test-secret-with-32-characters";
let server: RoscoServer | undefined;
const clients: Socket[] = [];

function emitAck<T>(socket: Socket, event: string, payload?: unknown): Promise<T> {
  return new Promise((resolve) => {
    if (payload === undefined) socket.emit(event, resolve);
    else socket.emit(event, payload, resolve);
  });
}

async function connectClient(url: string): Promise<Socket> {
  const socket = createClient(url, { transports: ["websocket"], forceNew: true });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });
  return socket;
}

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await server?.close();
  server = undefined;
});

describe("servidor Socket.IO", () => {
  it("vincula TV y control y retransmite intenciones y vistas", async () => {
    server = createRoscoServer(SECRET);
    await new Promise<void>((resolve) => server?.httpServer.listen(0, "127.0.0.1", resolve));
    const address = server.httpServer.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}`;
    const display = await connectClient(url);
    const control = await connectClient(url);

    const created = await emitAck<{
      ok: true;
      data: { roomId: string; code: string; controlToken: string };
    }>(display, "room:create");
    expect(created.ok).toBe(true);

    const joined = await emitAck<{ ok: boolean }>(control, "room:join-control", {
      code: created.data.code,
      token: created.data.controlToken
    });
    expect(joined.ok).toBe(true);

    const intentPromise = new Promise<unknown>((resolve) => display.once("control:intent", resolve));
    const intent = { type: "START_TURN", sequence: 1 };
    const intentAck = await emitAck<{ ok: boolean }>(control, "control:intent", {
      roomId: created.data.roomId,
      intent
    });
    expect(intentAck.ok).toBe(true);
    await expect(intentPromise).resolves.toEqual(intent);

    const configuration = {
      mode: "general",
      difficulty: "intermedio",
      durationSeconds: 120,
      regionalWeight: 0.3,
      speechEnabled: true,
      soundEffectsEnabled: true,
      players: [{ id: "p1", name: "Ana" }]
    };
    const configurationPromise = new Promise<unknown>((resolve) =>
      display.once("control:configuration", resolve)
    );
    const configurationAck = await emitAck<{ ok: boolean }>(control, "control:configuration", {
      roomId: created.data.roomId,
      config: configuration
    });
    expect(configurationAck.ok).toBe(true);
    await expect(configurationPromise).resolves.toEqual({ config: configuration });

    const view = {
      gameId: "game-1",
      phase: "ready",
      sequence: 0,
      canStart: true,
      canPass: false,
      canEmergencyPause: false,
      canResume: false,
      canUndo: false,
      canRepeatClue: false,
      soundEffectsEnabled: true
    };
    const statePromise = new Promise<unknown>((resolve) => control.once("display:state", resolve));
    const stateAck = await emitAck<{ ok: boolean }>(display, "display:state", {
      roomId: created.data.roomId,
      view
    });
    expect(stateAck.ok).toBe(true);
    await expect(statePromise).resolves.toEqual(view);
  });

  it("rechaza un control con token incorrecto", async () => {
    server = createRoscoServer(SECRET);
    await new Promise<void>((resolve) => server?.httpServer.listen(0, "127.0.0.1", resolve));
    const address = server.httpServer.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}`;
    const display = await connectClient(url);
    const control = await connectClient(url);
    const created = await emitAck<{ ok: true; data: { code: string } }>(display, "room:create");

    const joined = await emitAck<{ ok: false; error: string }>(control, "room:join-control", {
      code: created.data.code,
      token: "token-incorrecto-con-longitud-suficiente"
    });

    expect(joined).toEqual({ ok: false, error: "INVALID_ROOM_OR_TOKEN" });
  });
});
