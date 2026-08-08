import { describe, expect, it } from "vitest";
import { signRecoveryCredential, verifyRecoveryCredential } from "../../server/src/security/tokens.js";

const SECRET = "a-secure-test-secret-with-32-characters";

describe("credenciales de recuperación", () => {
  it("verifica una credencial válida", () => {
    const credential = signRecoveryCredential(
      { roomId: "room-1", code: "ABC234", expiresAt: 10_000 },
      SECRET
    );

    expect(verifyRecoveryCredential(credential, SECRET, 9_000)).toEqual({
      roomId: "room-1",
      code: "ABC234",
      expiresAt: 10_000
    });
  });

  it("rechaza alteraciones y credenciales vencidas", () => {
    const credential = signRecoveryCredential(
      { roomId: "room-1", code: "ABC234", expiresAt: 10_000 },
      SECRET
    );

    expect(verifyRecoveryCredential(`${credential}x`, SECRET, 9_000)).toBeNull();
    expect(verifyRecoveryCredential(credential, SECRET, 10_001)).toBeNull();
  });
});

