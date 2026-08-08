export interface Room {
  id: string;
  code: string;
  controlTokenHash: string;
  displaySocketId: string;
  controlSocketId: string | null;
  createdAt: number;
  lastActivityAt: number;
  recoveryExpiresAt: number;
}

export interface CreatedRoom {
  room: Room;
  controlToken: string;
  recoveryCredential: string;
}

export type SocketRole = "display" | "control";

export interface SocketAssignment {
  roomId: string;
  role: SocketRole;
}

