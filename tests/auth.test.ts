import { describe, expect, it } from "vitest";
import { constantTimeEqual, createSessionToken, verifySessionToken } from "../worker/auth";

describe("signed session", () => {
  const secret = "a-very-long-test-secret-at-least-32-characters";
  const passwordHash = "pbkdf2-sha256$600000$c2FsdA$ZXhwZWN0ZWQ";

  it("accepts an unmodified, unexpired token", async () => {
    const token = await createSessionToken(secret, passwordHash, 1_700_000_000_000);
    expect(await verifySessionToken(token, secret, passwordHash, 1_700_000_001_000)).toBe(true);
  });

  it("rejects tampered and expired tokens", async () => {
    const token = await createSessionToken(secret, passwordHash, 1_700_000_000_000);
    expect(await verifySessionToken(`${token}x`, secret, passwordHash, 1_700_000_001_000)).toBe(false);
    expect(await verifySessionToken(token, secret, passwordHash, 1_800_000_000_000)).toBe(false);
  });

  it("rejects a token after the password hash changes", async () => {
    const token = await createSessionToken(secret, passwordHash, 1_700_000_000_000);
    expect(await verifySessionToken(token, secret, `${passwordHash}-changed`, 1_700_000_001_000)).toBe(false);
  });

  it("compares byte arrays", () => {
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
  });
});
