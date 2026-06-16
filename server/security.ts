import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { ServerConfig } from "./config";

const AUTH_REALM = 'Basic realm="Dark Todo Planner", charset="UTF-8"';
const FAILED_AUTH_WINDOW_MS = 15 * 60 * 1000;
const FAILED_AUTH_LIMIT = 10;

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const failedAuthAttempts = new Map<string, { count: number; resetAt: number }>();

const normalizeOrigin = (value?: string | null) => {
  const trimmed = value?.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
};

const requestHostMatchesOrigin = (req: Request, origin: string) => {
  try {
    const parsed = new URL(origin);
    const host = req.get("host");
    const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
    return Boolean(host && parsed.host === host) || Boolean(forwardedHost && parsed.host === forwardedHost);
  } catch {
    return false;
  }
};

export const isAllowedOrigin = (req: Request, config: ServerConfig, originHeader?: string | null) => {
  const origin = normalizeOrigin(originHeader);
  if (!origin) return true;
  return config.clientOrigins.has(origin) || requestHostMatchesOrigin(req, origin);
};

const timingSafeStringEqual = (actual: string, expected: string) => {
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (actualBytes.length !== expectedBytes.length) {
    const compareLength = Math.max(actualBytes.length, expectedBytes.length, 1);
    crypto.timingSafeEqual(Buffer.alloc(compareLength), Buffer.alloc(compareLength));
    return false;
  }
  return crypto.timingSafeEqual(actualBytes, expectedBytes);
};

const parseBasicAuthorization = (value?: string) => {
  if (!value?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(value.slice(6).trim(), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) return null;
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
};

const getRateLimitKey = (req: Request) => req.ip || req.socket.remoteAddress || "unknown";

const getFailedAttemptBucket = (key: string) => {
  const now = Date.now();
  const current = failedAuthAttempts.get(key);
  if (!current || current.resetAt <= now) {
    const next = { count: 0, resetAt: now + FAILED_AUTH_WINDOW_MS };
    failedAuthAttempts.set(key, next);
    return next;
  }
  return current;
};

const sendAuthRequired = (res: Response) => {
  res.setHeader("WWW-Authenticate", AUTH_REALM);
  return res.status(401).json({ message: "인증이 필요합니다." });
};

export const resetSecurityRateLimitsForTests = () => {
  failedAuthAttempts.clear();
};

export const createCorsMiddleware =
  (config: ServerConfig) => (req: Request, res: Response, next: NextFunction) => {
    const origin = normalizeOrigin(req.get("origin"));
    if (origin && isAllowedOrigin(req, config, origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    }

    if (req.method === "OPTIONS") {
      return origin && !isAllowedOrigin(req, config, origin)
        ? res.status(403).json({ message: "허용되지 않은 요청 출처입니다." })
        : res.sendStatus(204);
    }

    return next();
  };

export const createOriginGuard =
  (config: ServerConfig) => (req: Request, res: Response, next: NextFunction) => {
    if (!mutatingMethods.has(req.method) || isAllowedOrigin(req, config, req.get("origin"))) {
      return next();
    }

    return res.status(403).json({ message: "허용되지 않은 요청 출처입니다." });
  };

export const createBasicAuthMiddleware =
  (config: ServerConfig) => (req: Request, res: Response, next: NextFunction) => {
    if (!config.auth.enabled || req.path === "/api/health") return next();

    const key = getRateLimitKey(req);
    const bucket = getFailedAttemptBucket(key);
    if (bucket.count >= FAILED_AUTH_LIMIT) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - Date.now()) / 1000)));
      return res.status(429).json({ message: "인증 시도가 너무 많습니다. 잠시 후 다시 시도하세요." });
    }

    const credentials = parseBasicAuthorization(req.get("authorization"));
    const authorized =
      credentials &&
      timingSafeStringEqual(credentials.username, config.auth.username) &&
      timingSafeStringEqual(credentials.password, config.auth.password);

    if (!authorized) {
      bucket.count += 1;
      return sendAuthRequired(res);
    }

    failedAuthAttempts.delete(key);
    return next();
  };
