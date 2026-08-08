import { io, type Socket } from "socket.io-client";

let socket: Socket | undefined;

export function getSocket(): Socket {
  socket ??= io({ autoConnect: true, transports: ["websocket", "polling"] });
  return socket;
}

export function emitWithAck<T>(event: string, payload?: unknown): Promise<T> {
  const current = getSocket();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("TIMEOUT")), 10_000);
    const finish = (response: T) => {
      window.clearTimeout(timeout);
      resolve(response);
    };
    if (payload === undefined) current.emit(event, finish);
    else current.emit(event, payload, finish);
  });
}

