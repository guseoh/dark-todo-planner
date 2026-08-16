import { describe, expect, it } from "vitest";
import { createSessionToken, SESSION_TTL_SECONDS, verifySessionToken } from "./auth";

const secret = "s".repeat(64);
const passwordHash = "pbkdf2-sha256$600000$c2FsdA$ZXhwZWN0ZWQ";

describe("session token v2", () => {
  it("accepts a valid token and expires it after the absolute TTL", async () => {
    const now = Date.UTC(2026, 7, 16, 8, 0, 0);
    const token = await createSessionToken(secret, passwordHash, now);

    expect(await verifySessionToken(token, secret, passwordHash, now)).toBe(true);
    expect(await verifySessionToken(token, secret, passwordHash, now + SESSION_TTL_SECONDS * 1000)).toBe(false);
  });

  it("invalidates existing sessions when the password hash changes", async () => {
    const now = Date.UTC(2026, 7, 16, 8, 0, 0);
    const token = await createSessionToken(secret, passwordHash, now);

    expect(await verifySessionToken(token, secret, `${passwordHash}-rotated`, now)).toBe(false);
  });

  it("creates different tokens even within the same second", async () => {
    const now = Date.UTC(2026, 7, 16, 8, 0, 0);
    const first = await createSessionToken(secret, passwordHash, now);
    const second = await createSessionToken(secret, passwordHash, now);

    expect(first).not.toBe(second);
  });

  it("rejects legacy or malformed token shapes", async () => {
    const now = Date.UTC(2026, 7, 16, 8, 0, 0);
    expect(await verifySessionToken("v1.123.signature", secret, passwordHash, now)).toBe(false);
    expect(await verifySessionToken(undefined, secret, passwordHash, now)).toBe(false);
  });
});
