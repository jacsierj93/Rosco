import { randomInt, randomUUID } from "node:crypto";
import { createControlToken, hashToken, signRecoveryCredential, tokenMatches, verifyRecoveryCredential } from "../security/tokens.js";
import type { CreatedRoom, Room, SocketAssignment } from "./types.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_IDLE_MS = 2 * 60 * 60 * 1_000;
const RECOVERY_TTL_MS = 24 * 60 * 60 * 1_000;

export class RoomManager {
  private readonly roomsById = new Map<string, Room>();
  private readonly roomIdByCode = new Map<string, string>();
  private readonly assignments = new Map<string, SocketAssignment>();

  constructor(private readonly signingSecret: string) {
    if (signingSecret.length < 32) throw new Error("ROOM_SIGNING_SECRET debe tener al menos 32 caracteres");
  }

  create(displaySocketId: string, now = Date.now()): CreatedRoom {
    const roomId = randomUUID();
    return this.createWithIdentity(roomId, this.createUniqueCode(), displaySocketId, now);
  }

  resume(displaySocketId: string, credential: string, controlToken?: string, now = Date.now()): CreatedRoom | null {
    const payload = verifyRecoveryCredential(credential, this.signingSecret, now);
    if (!payload) return null;

    const existing = this.roomsById.get(payload.roomId);
    if (existing && controlToken && tokenMatches(controlToken, existing.controlTokenHash)) {
      if (existing.displaySocketId) this.assignments.delete(existing.displaySocketId);
      existing.displaySocketId = displaySocketId;
      existing.lastActivityAt = now;
      this.assignments.set(displaySocketId, { roomId: existing.id, role: "display" });
      return {
        room: existing,
        controlToken,
        recoveryCredential: signRecoveryCredential(
          { roomId: existing.id, code: existing.code, expiresAt: existing.recoveryExpiresAt },
          this.signingSecret
        )
      };
    }
    if (existing) this.remove(existing.id);
    const code = this.roomIdByCode.has(payload.code) ? this.createUniqueCode() : payload.code;
    return this.createWithIdentity(payload.roomId, code, displaySocketId, now, controlToken);
  }

  joinControl(code: string, token: string, controlSocketId: string, now = Date.now()): Room | null {
    const roomId = this.roomIdByCode.get(code.toUpperCase());
    const room = roomId ? this.roomsById.get(roomId) : undefined;
    if (!room || !tokenMatches(token, room.controlTokenHash)) return null;

    if (room.controlSocketId) this.assignments.delete(room.controlSocketId);
    room.controlSocketId = controlSocketId;
    room.lastActivityAt = now;
    this.assignments.set(controlSocketId, { roomId: room.id, role: "control" });
    return room;
  }

  touch(roomId: string, now = Date.now()): void {
    const room = this.roomsById.get(roomId);
    if (room) room.lastActivityAt = now;
  }

  getById(roomId: string): Room | undefined {
    return this.roomsById.get(roomId);
  }

  assignmentFor(socketId: string): SocketAssignment | undefined {
    return this.assignments.get(socketId);
  }

  disconnect(socketId: string): { room: Room; role: "display" | "control" } | null {
    const assignment = this.assignments.get(socketId);
    if (!assignment) return null;
    this.assignments.delete(socketId);
    const room = this.roomsById.get(assignment.roomId);
    if (!room) return null;
    if (assignment.role === "control") room.controlSocketId = null;
    if (assignment.role === "display") room.displaySocketId = "";
    return { room, role: assignment.role };
  }

  cleanup(now = Date.now()): number {
    let removed = 0;
    for (const room of this.roomsById.values()) {
      if (now - room.lastActivityAt >= ROOM_IDLE_MS) {
        this.remove(room.id);
        removed += 1;
      }
    }
    return removed;
  }

  private createWithIdentity(roomId: string, code: string, displaySocketId: string, now: number, existingControlToken?: string): CreatedRoom {
    const controlToken = existingControlToken ?? createControlToken();
    const recoveryExpiresAt = now + RECOVERY_TTL_MS;
    const room: Room = {
      id: roomId,
      code,
      controlTokenHash: hashToken(controlToken),
      displaySocketId,
      controlSocketId: null,
      createdAt: now,
      lastActivityAt: now,
      recoveryExpiresAt
    };
    this.roomsById.set(roomId, room);
    this.roomIdByCode.set(code, roomId);
    this.assignments.set(displaySocketId, { roomId, role: "display" });
    return {
      room,
      controlToken,
      recoveryCredential: signRecoveryCredential(
        { roomId, code, expiresAt: recoveryExpiresAt },
        this.signingSecret
      )
    };
  }

  private createUniqueCode(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      let code = "";
      for (let index = 0; index < 6; index += 1) {
        code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      }
      if (!this.roomIdByCode.has(code)) return code;
    }
    throw new Error("No se pudo generar un código de sala único");
  }

  private remove(roomId: string): void {
    const room = this.roomsById.get(roomId);
    if (!room) return;
    this.roomsById.delete(roomId);
    this.roomIdByCode.delete(room.code);
    if (room.displaySocketId) this.assignments.delete(room.displaySocketId);
    if (room.controlSocketId) this.assignments.delete(room.controlSocketId);
  }
}
