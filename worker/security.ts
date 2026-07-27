import type { Context, MiddlewareHandler } from "hono";
import type { Bindings, Variables } from "./types";

const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "img-src 'self' data: blob: https:",
    "manifest-src 'self'",
    "media-src 'self' https:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
} as const;

const API_NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Expires: "0",
  Pragma: "no-cache",
} as const;

export const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const clientIdentifier = (request: Request) =>
  request.headers.get("CF-Connecting-IP")?.trim() || "unknown";

export const securityHeaders: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (context, next) => {
  await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) context.header(name, value);
};

export const preventApiCaching: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (context, next) => {
  await next();
  for (const [name, value] of Object.entries(API_NO_STORE_HEADERS)) context.header(name, value);
};

export const tooManyRequests = (context: Context<{ Bindings: Bindings; Variables: Variables }>) => {
  context.header("Retry-After", "60");
  return context.json({ message: "요청이 너무 많습니다. 1분 후 다시 시도해 주세요." }, 429);
};
