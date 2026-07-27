import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { clientIdentifier, preventApiCaching, SAFE_METHODS, securityHeaders, tooManyRequests } from "../worker/security";
import type { Bindings, Variables } from "../worker/types";

describe("security middleware", () => {
  const createApp = () => {
    const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
    app.use("*", securityHeaders);
    app.use("/api/*", preventApiCaching);
    app.get("/api/example", (context) => context.json({ ok: true }));
    app.get("/limited", (context) => tooManyRequests(context));
    return app;
  };

  it("sets security headers and prevents API response caching", async () => {
    const response = await createApp().request("http://localhost/api/example", undefined, {} as Bindings);

    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(response.headers.get("Expires")).toBe("0");
  });

  it("returns a retry hint for rate-limited requests", async () => {
    const response = await createApp().request("http://localhost/limited", undefined, {} as Bindings);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toEqual({ message: "요청이 너무 많습니다. 1분 후 다시 시도해 주세요." });
  });

  it("uses the Cloudflare client address and recognizes safe methods", () => {
    expect(clientIdentifier(new Request("https://example.com", { headers: { "CF-Connecting-IP": "203.0.113.10" } }))).toBe("203.0.113.10");
    expect(clientIdentifier(new Request("https://example.com"))).toBe("unknown");
    expect(SAFE_METHODS.has("GET")).toBe(true);
    expect(SAFE_METHODS.has("POST")).toBe(false);
  });
});
