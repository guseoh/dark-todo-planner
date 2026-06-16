import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";
import { loadServerConfig } from "../server/config";
import {
  createBasicAuthMiddleware,
  createCorsMiddleware,
  createOriginGuard,
  resetSecurityRateLimitsForTests,
} from "../server/security";

const baseEnv = {
  NODE_ENV: "development",
  DATABASE_URL: "file:../data/test.db",
  PORT: "3000",
  HOST: "127.0.0.1",
  CLIENT_URL: "http://client.local",
};

const basicAuth = (username: string, password: string) =>
  `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

const buildApp = (env: NodeJS.ProcessEnv = {}) => {
  const config = loadServerConfig({ ...baseEnv, ...env });
  const app = express();

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use(createCorsMiddleware(config));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (req) => req.path === "/api/health",
      message: { message: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
    }),
  );
  app.use(createOriginGuard(config));
  app.use(createBasicAuthMiddleware(config));
  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.get("/api/protected", (_req, res) => res.json({ ok: true }));
  app.post("/api/protected", (_req, res) => res.json({ ok: true }));
  app.get("/", (_req, res) => res.type("html").send("<!doctype html><title>Dark Todo Planner</title>"));

  return app;
};

const request = async (app: Express, path: string, init?: RequestInit) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, init);
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Keep plain text responses as-is.
    }
    return { response, body };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

afterEach(() => {
  resetSecurityRateLimitsForTests();
});

test("health check stays public when app access authentication is enabled", async () => {
  const app = buildApp({ APP_AUTH_ENABLED: "true", APP_AUTH_USERNAME: "owner", APP_AUTH_PASSWORD: "secret" });
  const { response, body } = await request(app, "/api/health");

  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: "ok" });
});

test("app access authentication protects API and static routes", async () => {
  const app = buildApp({ APP_AUTH_ENABLED: "true", APP_AUTH_USERNAME: "owner", APP_AUTH_PASSWORD: "secret" });

  const api = await request(app, "/api/protected");
  const page = await request(app, "/");

  assert.equal(api.response.status, 401);
  assert.match(api.response.headers.get("www-authenticate") || "", /Dark Todo Planner/);
  assert.equal(page.response.status, 401);
  assert.doesNotMatch(JSON.stringify(api.body), /secret/);
});

test("valid app access credentials allow protected routes", async () => {
  const app = buildApp({ APP_AUTH_ENABLED: "true", APP_AUTH_USERNAME: "owner", APP_AUTH_PASSWORD: "secret" });
  const { response, body } = await request(app, "/api/protected", {
    headers: { Authorization: basicAuth("owner", "secret") },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true });
});

test("mutating requests from disallowed origins are rejected", async () => {
  const app = buildApp();
  const { response, body } = await request(app, "/api/protected", {
    method: "POST",
    headers: { Origin: "http://evil.local", "Content-Type": "application/json" },
    body: "{}",
  });

  assert.equal(response.status, 403);
  assert.deepEqual(body, { message: "허용되지 않은 요청 출처입니다." });
});

test("allowed origins and CLI-style requests without Origin can mutate", async () => {
  const app = buildApp();

  const allowed = await request(app, "/api/protected", {
    method: "POST",
    headers: { Origin: "http://client.local", "Content-Type": "application/json" },
    body: "{}",
  });
  const noOrigin = await request(app, "/api/protected", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

  assert.equal(allowed.response.status, 200);
  assert.equal(allowed.response.headers.get("access-control-allow-origin"), "http://client.local");
  assert.equal(noOrigin.response.status, 200);
});

test("production startup requires authentication or an explicit insecure override", () => {
  assert.throws(
    () => loadServerConfig({ ...baseEnv, NODE_ENV: "production", HOST: "0.0.0.0" }),
    /APP_AUTH_ENABLED=true/,
  );

  assert.throws(
    () => loadServerConfig({ ...baseEnv, NODE_ENV: "production", APP_AUTH_ENABLED: "true" }),
    /APP_AUTH_USERNAME/,
  );

  const config = loadServerConfig({
    ...baseEnv,
    NODE_ENV: "production",
    HOST: "0.0.0.0",
    APP_AUTH_ENABLED: "true",
    APP_AUTH_USERNAME: "owner",
    APP_AUTH_PASSWORD: "secret",
  });
  assert.equal(config.auth.enabled, true);
  assert.equal(config.backupJsonBodyLimit, "4mb");

  const insecure = loadServerConfig({
    ...baseEnv,
    NODE_ENV: "production",
    ALLOW_INSECURE_PUBLIC_ACCESS: "true",
  });
  assert.equal(insecure.auth.allowInsecurePublicAccess, true);
});
