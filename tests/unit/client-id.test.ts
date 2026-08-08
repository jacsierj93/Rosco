import { describe, expect, it, vi } from "vitest";
import { createClientId } from "../../client/src/lib/id.js";

describe("createClientId", () => {
  it("usa randomUUID cuando está disponible", () => {
    const randomUUID = vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-1111-4111-8111-111111111111");

    expect(createClientId()).toBe("11111111-1111-4111-8111-111111111111");
    randomUUID.mockRestore();
  });

  it("genera un UUID v4 cuando randomUUID no está disponible", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { configurable: true, value: undefined });

    expect(createClientId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    Object.defineProperty(crypto, "randomUUID", { configurable: true, value: original });
  });
});
