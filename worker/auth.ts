import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import type { Bindings, Variables } from "./types";

export const USER_ID = "single-user";
export const SESSION_COOKIE = "__Host-dtp_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const MIN_PBKDF2_ROUNDS = 100_000;
const MAX_PBKDF2_ROUNDS = 5_000_000;
const encoder = new TextEncoder();
const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const fromBase64 = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));

export const constantTimeEqual = (left: Uint8Array, right: Uint8Array) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
};

export const constantTimeTextEqual = (left: string, right: string) => constantTimeEqual(encoder.encode(left), encoder.encode(right));

export async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, roundsRaw, saltRaw, expectedRaw] = encodedHash.split("$");
  const rounds = Number(roundsRaw);
  if (
    algorithm !== "pbkdf2-sha256"
    || !Number.isInteger(rounds)
    || rounds < MIN_PBKDF2_ROUNDS
    || rounds > MAX_PBKDF2_ROUNDS
    || !saltRaw
    || !expectedRaw
  ) return false;

  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const expected = fromBase64(expectedRaw);
    const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltRaw), iterations: rounds }, key, expected.length * 8));
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function sign(value: string, secret: string, passwordHash: string) {
  const keyMaterial = `${secret}\u0000${passwordHash}`;
  const key = await crypto.subtle.importKey("raw", encoder.encode(keyMaterial), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function createSessionToken(secret: string, passwordHash: string, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + SESSION_TTL_SECONDS;
  const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const payload = `v2.${issuedAt}.${expiresAt}.${nonce}`;
  return `${payload}.${await sign(payload, secret, passwordHash)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string, passwordHash: string, now = Date.now()) {
  if (!token || secret.length < 32 || !passwordHash) return false;
  const [version, issuedRaw, expiresRaw, nonce, signature, ...extra] = token.split(".");
  const issuedAt = Number(issuedRaw);
  const expiresAt = Number(expiresRaw);
  const nowSeconds = Math.floor(now / 1000);
  if (
    version !== "v2"
    || extra.length > 0
    || !Number.isInteger(issuedAt)
    || !Number.isInteger(expiresAt)
    || issuedAt > nowSeconds + 60
    || expiresAt !== issuedAt + SESSION_TTL_SECONDS
    || expiresAt <= nowSeconds
    || !nonce
    || nonce.length < 16
    || !signature
  ) return false;

  const expected = await sign(`${version}.${issuedRaw}.${expiresRaw}.${nonce}`, secret, passwordHash);
  return constantTimeTextEqual(signature, expected);
}

export const setSessionCookie = (context: Parameters<typeof setCookie>[0], token: string) => setCookie(context, SESSION_COOKIE, token, {
  httpOnly: true,
  secure: true,
  sameSite: "Strict",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
});

export const clearSessionCookie = (context: Parameters<typeof deleteCookie>[0]) => deleteCookie(context, SESSION_COOKIE, {
  secure: true,
  path: "/",
  sameSite: "Strict",
});

export const requireAuth: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (context, next) => {
  const authenticated = await verifySessionToken(
    getCookie(context, SESSION_COOKIE),
    context.env.SESSION_SECRET,
    context.env.AUTH_PASSWORD_HASH,
  );
  if (!authenticated) {
    clearSessionCookie(context);
    return context.json({ message: "로그인이 필요합니다." }, 401);
  }

  context.set("userId", USER_ID);
  const now = new Date().toISOString();
  await context.env.DB.prepare("INSERT OR IGNORE INTO users (id, email, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(USER_ID, "single-user@dark-todo-planner.local", "개인 사용자", now, now).run();
  await next();
};
