import { describe, expect, it } from "vitest";
import { createSessionToken, SESSION_TTL_SECONDS, verifyPassword, verifySessionToken } from "./auth";

const secret = "s".repeat(64);
const passwordHash = "scrypt$16384$8$5$ZGFyay10b2RvLXBsYW5uZXItdGVzdC1zYWx0$qdklVsSwgv4C2He9QGZlO6hma4gBvcO1KdzA3rJXL14";

describe("password verification", () => {
  const password = "correct horse battery staple";
  const validHash = passwordHash;

  it("accepts a valid scrypt hash with the Worker-compatible profile", async () => {
    expect(await verifyPassword(password, validHash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    expect(await verifyPassword("incorrect password", validHash)).toBe(false);
  });

  it("rejects legacy PBKDF2 hashes", async () => {
    const legacyHash = "pbkdf2-sha256$600000$ZGFyay10b2RvLXBsYW5uZXItdGVzdC1zYWx0$tuxlMKacmjDRzD__BPOBoD27oBApl2JrqowkfwMbklw";
    expect(await verifyPassword(password, legacyHash)).toBe(false);
  });

  it("rejects scrypt hashes with unexpected cost parameters before derivation", async () => {
    expect(await verifyPassword(password, validHash.replace("$16384$8$5$", "$32768$8$5$"))).toBe(false);
  });

  it("rejects malformed scrypt hashes", async () => {
    expect(await verifyPassword(password, "scrypt$16384$8$5$missing-digest")).toBe(false);
  });
});

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
