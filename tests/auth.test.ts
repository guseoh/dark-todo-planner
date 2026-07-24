import { describe, expect, it } from "vitest";
import { constantTimeEqual, createSessionToken, verifySessionToken } from "../worker/auth";

describe("signed session", () => {
  const secret = "a-very-long-test-secret-at-least-32-characters";
  it("accepts an unmodified, unexpired token", async () => {
    const token = await createSessionToken(secret, 1_700_000_000_000);
    expect(await verifySessionToken(token, secret, 1_700_000_001_000)).toBe(true);
  });
  it("rejects tampered and expired tokens", async () => {
    const token = await createSessionToken(secret, 1_700_000_000_000);
    expect(await verifySessionToken(`${token}x`, secret, 1_700_000_001_000)).toBe(false);
    expect(await verifySessionToken(token, secret, 1_800_000_000_000)).toBe(false);
  });
  it("compares byte arrays", () => {
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
  });
});
