import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import type { Bindings, Variables } from "./types";

export const USER_ID = "single-user";
export const SESSION_COOKIE = "__Host-dtp_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();
const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const fromBase64 = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));

export const constantTimeEqual = (left: Uint8Array, right: Uint8Array) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
};

export async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, roundsRaw, saltRaw, expectedRaw] = encodedHash.split("$");
  const rounds = Number(roundsRaw);
  if (algorithm !== "pbkdf2-sha256" || !Number.isInteger(rounds) || rounds < 100_000 || !saltRaw || !expectedRaw) return false;
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const expected = fromBase64(expectedRaw);
    const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltRaw), iterations: rounds }, key, expected.length * 8));
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function createSessionToken(secret: string, now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const payload = `v1.${expiresAt}`;
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string, now = Date.now()) {
  if (!token || secret.length < 32) return false;
  const [version, expiresRaw, signature] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (version !== "v1" || !Number.isInteger(expiresAt) || expiresAt <= Math.floor(now / 1000) || !signature) return false;
  const expected = await sign(`${version}.${expiresRaw}`, secret);
  return constantTimeEqual(encoder.encode(signature), encoder.encode(expected));
}

export const setSessionCookie = (context: Parameters<typeof setCookie>[0], token: string) => setCookie(context, SESSION_COOKIE, token, {
  httpOnly: true, secure: true, sameSite: "Strict", path: "/", maxAge: SESSION_TTL_SECONDS,
});

export const clearSessionCookie = (context: Parameters<typeof deleteCookie>[0]) => deleteCookie(context, SESSION_COOKIE, {
  secure: true, path: "/", sameSite: "Strict",
});

export const requireAuth: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (context, next) => {
  if (!await verifySessionToken(getCookie(context, SESSION_COOKIE), context.env.SESSION_SECRET)) {
    clearSessionCookie(context);
    return context.json({ message: "로그인이 필요합니다." }, 401);
  }
  context.set("userId", USER_ID);
  const now = new Date().toISOString();
  await context.env.DB.prepare("INSERT OR IGNORE INTO users (id, email, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(USER_ID, "single-user@dark-todo-planner.local", "개인 사용자", now, now).run();
  await next();
};
