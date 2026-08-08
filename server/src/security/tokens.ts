import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function createControlToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function tokenMatches(token: string, expectedHash: string): boolean {
  const received = Buffer.from(hashToken(token));
  const expected = Buffer.from(expectedHash);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

interface RecoveryPayload {
  roomId: string;
  code: string;
  expiresAt: number;
}

export function signRecoveryCredential(payload: RecoveryPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyRecoveryCredential(
  credential: string,
  secret: string,
  now = Date.now()
): RecoveryPayload | null {
  const [encoded, signature, extra] = credential.split(".");
  if (!encoded || !signature || extra !== undefined) return null;
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("roomId" in payload) ||
      !("code" in payload) ||
      !("expiresAt" in payload) ||
      typeof payload.roomId !== "string" ||
      typeof payload.code !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= now
    ) {
      return null;
    }
    return { roomId: payload.roomId, code: payload.code, expiresAt: payload.expiresAt };
  } catch {
    return null;
  }
}

