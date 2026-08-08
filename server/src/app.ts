import { createServer, type Server as HttpServer } from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import helmet from "helmet";
import { Server as SocketServer, type Socket } from "socket.io";
import {
  configurationEnvelopeSchema,
  controlIntentEnvelopeSchema,
  displayStateSchema,
  joinControlSchema,
  resumeDisplaySchema,
  roomEnvelopeSchema
} from "./protocol/schemas.js";
import { RoomManager } from "./rooms/room-manager.js";
import { SlidingWindowRateLimiter } from "./security/rate-limiter.js";

interface AckSuccess<T> { ok: true; data: T }
interface AckFailure { ok: false; error: string }
type Ack<T> = (result: AckSuccess<T> | AckFailure) => void;

export interface RoscoServer {
  httpServer: HttpServer;
  io: SocketServer;
  rooms: RoomManager;
  close: () => Promise<void>;
}

function clientKey(socket: Socket): string {
  return socket.handshake.address || "unknown";
}

export function createRoscoServer(signingSecret: string): RoscoServer {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "16kb" }));
  app.get("/health", (_request, response) => response.json({ ok: true }));
  const clientDirectory = resolve(process.cwd(), "dist/client");
  if (existsSync(clientDirectory)) {
    app.use(express.static(clientDirectory));
    app.get(/.*/, (_request, response) => response.sendFile(resolve(clientDirectory, "index.html")));
  }

  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, {
    maxHttpBufferSize: 16 * 1024,
    cors: { origin: false }
  });
  const rooms = new RoomManager(signingSecret);
  const joinLimiter = new SlidingWindowRateLimiter(10, 60_000);

  io.on("connection", (socket) => {
    socket.on("room:create", (ack: Ack<{ roomId: string; code: string; controlToken: string; recoveryCredential: string }>) => {
      if (rooms.assignmentFor(socket.id)) return ack({ ok: false, error: "SOCKET_ALREADY_ASSIGNED" });
      const created = rooms.create(socket.id);
      void socket.join(created.room.id);
      ack({
        ok: true,
        data: {
          roomId: created.room.id,
          code: created.room.code,
          controlToken: created.controlToken,
          recoveryCredential: created.recoveryCredential
        }
      });
    });

    socket.on("room:resume-display", (payload: unknown, ack: Ack<{ roomId: string; code: string; controlToken: string; recoveryCredential: string }>) => {
      const parsed = resumeDisplaySchema.safeParse(payload);
      if (!parsed.success) return ack({ ok: false, error: "INVALID_PAYLOAD" });
      const resumed = rooms.resume(socket.id, parsed.data.credential, parsed.data.controlToken);
      if (!resumed) return ack({ ok: false, error: "INVALID_CREDENTIAL" });
      void socket.join(resumed.room.id);
      if (resumed.room.controlSocketId) {
        io.to(resumed.room.controlSocketId).emit("room:peer-status", { displayConnected: true });
        socket.emit("room:peer-status", { controlConnected: true });
      }
      ack({
        ok: true,
        data: {
          roomId: resumed.room.id,
          code: resumed.room.code,
          controlToken: resumed.controlToken,
          recoveryCredential: resumed.recoveryCredential
        }
      });
    });

    socket.on("room:join-control", (payload: unknown, ack: Ack<{ roomId: string }>) => {
      const key = clientKey(socket);
      if (!joinLimiter.allow(key)) return ack({ ok: false, error: "RATE_LIMITED" });
      const parsed = joinControlSchema.safeParse(payload);
      if (!parsed.success) return ack({ ok: false, error: "INVALID_PAYLOAD" });
      const room = rooms.joinControl(parsed.data.code, parsed.data.token, socket.id);
      if (!room) return ack({ ok: false, error: "INVALID_ROOM_OR_TOKEN" });
      void socket.join(room.id);
      io.to(room.displaySocketId).emit("room:peer-status", { controlConnected: true });
      ack({ ok: true, data: { roomId: room.id } });
    });

    socket.on("control:intent", (payload: unknown, ack: Ack<Record<string, never>>) => {
      const parsed = controlIntentEnvelopeSchema.safeParse(payload);
      const assignment = rooms.assignmentFor(socket.id);
      if (!parsed.success || !assignment || assignment.role !== "control" || assignment.roomId !== parsed.data.roomId) {
        return ack({ ok: false, error: "FORBIDDEN" });
      }
      const room = rooms.getById(assignment.roomId);
      if (!room?.displaySocketId) return ack({ ok: false, error: "DISPLAY_OFFLINE" });
      rooms.touch(room.id);
      io.to(room.displaySocketId).emit("control:intent", parsed.data.intent);
      ack({ ok: true, data: {} });
    });

    socket.on("control:configuration", (payload: unknown, ack: Ack<Record<string, never>>) => {
      const parsed = configurationEnvelopeSchema.safeParse(payload);
      const assignment = rooms.assignmentFor(socket.id);
      if (!parsed.success || !assignment || assignment.role !== "control" || assignment.roomId !== parsed.data.roomId) {
        return ack({ ok: false, error: "FORBIDDEN" });
      }
      const room = rooms.getById(assignment.roomId);
      if (!room?.displaySocketId) return ack({ ok: false, error: "DISPLAY_OFFLINE" });
      rooms.touch(room.id);
      io.to(room.displaySocketId).emit("control:configuration", { config: parsed.data.config });
      ack({ ok: true, data: {} });
    });

    socket.on("display:state", (payload: unknown, ack: Ack<Record<string, never>>) => {
      const parsed = displayStateSchema.safeParse(payload);
      const assignment = rooms.assignmentFor(socket.id);
      if (!parsed.success || !assignment || assignment.role !== "display" || assignment.roomId !== parsed.data.roomId) {
        return ack({ ok: false, error: "FORBIDDEN" });
      }
      const room = rooms.getById(assignment.roomId);
      rooms.touch(assignment.roomId);
      if (room?.controlSocketId) io.to(room.controlSocketId).emit("display:state", parsed.data.view);
      ack({ ok: true, data: {} });
    });

    socket.on("display:reset", (payload: unknown, ack: Ack<Record<string, never>>) => {
      const parsed = roomEnvelopeSchema.safeParse(payload);
      const assignment = rooms.assignmentFor(socket.id);
      if (!parsed.success || !assignment || assignment.role !== "display" || assignment.roomId !== parsed.data.roomId) {
        return ack({ ok: false, error: "FORBIDDEN" });
      }
      const room = rooms.getById(assignment.roomId);
      if (room?.controlSocketId) io.to(room.controlSocketId).emit("display:reset");
      ack({ ok: true, data: {} });
    });

    socket.on("disconnect", () => {
      const disconnected = rooms.disconnect(socket.id);
      if (!disconnected) return;
      const target = disconnected.role === "control"
        ? disconnected.room.displaySocketId
        : disconnected.room.controlSocketId;
      if (target) {
        io.to(target).emit("room:peer-status", {
          controlConnected: disconnected.role !== "control",
          displayConnected: disconnected.role !== "display"
        });
      }
    });
  });

  const cleanupTimer = setInterval(() => {
    rooms.cleanup();
    joinLimiter.cleanup();
  }, 60_000);
  cleanupTimer.unref();

  return {
    httpServer,
    io,
    rooms,
    close: async () => {
      clearInterval(cleanupTimer);
      await new Promise<void>((resolve) => io.close(() => resolve()));
      if (httpServer.listening) await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  };
}
