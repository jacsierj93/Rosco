import { describe, expect, it } from "vitest";
import { RoomManager } from "../../server/src/rooms/room-manager.js";

const SECRET = "a-secure-test-secret-with-32-characters";

describe("RoomManager", () => {
  it("crea una sala y vincula el control con el token correcto", () => {
    const rooms = new RoomManager(SECRET);
    const created = rooms.create("display-1", 1_000);

    expect(created.room.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(rooms.joinControl(created.room.code, "incorrecto", "control-1", 2_000)).toBeNull();
    expect(rooms.joinControl(created.room.code, created.controlToken, "control-1", 2_000)?.id)
      .toBe(created.room.id);
    expect(rooms.assignmentFor("control-1")).toEqual({ roomId: created.room.id, role: "control" });
  });

  it("recupera una sala con un token de control nuevo", () => {
    const roomsBeforeRestart = new RoomManager(SECRET);
    const created = roomsBeforeRestart.create("display-1", 1_000);
    const roomsAfterRestart = new RoomManager(SECRET);
    const resumed = roomsAfterRestart.resume("display-2", created.recoveryCredential, created.controlToken, 2_000);

    expect(resumed?.room.id).toBe(created.room.id);
    expect(resumed?.room.code).toBe(created.room.code);
    expect(resumed?.controlToken).toBe(created.controlToken);
  });

  it("reconecta la TV sin expulsar al control existente", () => {
    const rooms = new RoomManager(SECRET);
    const created = rooms.create("display-1", 1_000);
    rooms.joinControl(created.room.code, created.controlToken, "control-1", 1_500);

    const resumed = rooms.resume("display-2", created.recoveryCredential, created.controlToken, 2_000);

    expect(resumed?.room.displaySocketId).toBe("display-2");
    expect(resumed?.room.controlSocketId).toBe("control-1");
    expect(rooms.assignmentFor("control-1")?.role).toBe("control");
  });

  it("elimina salas luego de dos horas sin actividad", () => {
    const rooms = new RoomManager(SECRET);
    const created = rooms.create("display-1", 0);

    expect(rooms.cleanup(2 * 60 * 60 * 1_000 - 1)).toBe(0);
    expect(rooms.cleanup(2 * 60 * 60 * 1_000)).toBe(1);
    expect(rooms.getById(created.room.id)).toBeUndefined();
  });
});
