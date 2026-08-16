import { scrypt } from "node:crypto";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import type { Bindings, Variables } from "./types";

export const USER_ID = "single-user";
export const SESSION_COOKIE = "__Host-dtp_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 5;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MAXMEM = 32 * 1024 * 1024;
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

const derivePassword = (password: string, salt: Uint8Array) => new Promise<Uint8Array>((resolve, reject) => {
  scrypt(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  }, (error, derivedKey) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(new Uint8Array(derivedKey));
  });
});

export async function verifyPassword(password: string, encodedHash: string) {
  const parts = encodedHash.split("$");
  if (parts.length !== 6) return false;

  const [algorithm, nRaw, rRaw, pRaw, saltRaw, expectedRaw] = parts;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (
    algorithm !== "scrypt"
    || n !== SCRYPT_N
    || r !== SCRYPT_R
    || p !== SCRYPT_P
    || !saltRaw
    || !expectedRaw
  ) return false;

  try {
    const expected = fromBase64(expectedRaw);
    if (expected.length !== SCRYPT_KEY_LENGTH) return false;
    const actual = await derivePassword(password, fromBase64(saltRaw));
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
