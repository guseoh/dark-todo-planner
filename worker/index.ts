import { Hono } from "hono";
import { z, ZodError } from "zod";
import { clearSessionCookie, createSessionToken, requireAuth, setSessionCookie, verifyPassword, verifySessionToken, SESSION_COOKIE } from "./auth";
import { getCookie } from "hono/cookie";
import type { Bindings, Variables } from "./types";
import { backupRoutes } from "./routes/backup";
import { contentRoutes } from "./routes/content";
import { libraryRoutes } from "./routes/library";
import { todoRoutes } from "./routes/todos";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1).max(1024) });

app.use("/api/*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) && c.req.header("Sec-Fetch-Site") === "cross-site") return c.json({ message: "교차 사이트 요청은 허용되지 않습니다." }, 403);
  const publicPaths = ["/api/health", "/api/auth/login", "/api/auth/logout", "/api/auth/session"];
  if (publicPaths.includes(c.req.path)) return next();
  return requireAuth(c, next);
});

app.get("/api/health", async (c) => { await c.env.DB.prepare("SELECT 1").first(); return c.json({ status: "ok", database: "connected" }); });
app.post("/api/auth/login", async (c) => {
  if (!c.env.AUTH_USERNAME || !c.env.AUTH_PASSWORD_HASH || !c.env.SESSION_SECRET || c.env.SESSION_SECRET.length < 32) return c.json({ message: "인증 Secret이 올바르게 설정되지 않았습니다." }, 503);
  const input = loginSchema.parse(await c.req.json());
  const validPassword = await verifyPassword(input.password, c.env.AUTH_PASSWORD_HASH);
  const validUsername = input.username === c.env.AUTH_USERNAME;
  if (!validUsername || !validPassword) return c.json({ message: "사용자명 또는 비밀번호가 올바르지 않습니다." }, 401);
  setSessionCookie(c, await createSessionToken(c.env.SESSION_SECRET));
  return c.json({ authenticated: true, username: c.env.AUTH_USERNAME });
});
app.post("/api/auth/logout", (c) => { clearSessionCookie(c); return c.json({ authenticated: false }); });
app.get("/api/auth/session", async (c) => {
  const authenticated = await verifySessionToken(getCookie(c, SESSION_COOKIE), c.env.SESSION_SECRET || "");
  return c.json(authenticated ? { authenticated: true, username: c.env.AUTH_USERNAME } : { authenticated: false }, authenticated ? 200 : 401);
});

app.route("/api", todoRoutes);
app.route("/api", contentRoutes);
app.route("/api", libraryRoutes);
app.route("/api", backupRoutes);

app.notFound((c) => c.req.path.startsWith("/api/") ? c.json({ message: "API 경로를 찾을 수 없습니다." }, 404) : c.env.ASSETS.fetch(c.req.raw));
app.onError((error, c) => {
  if (error instanceof ZodError) return c.json({ message: "입력값이 올바르지 않습니다.", issues: error.issues }, 400);
  if (error instanceof SyntaxError) return c.json({ message: "JSON 요청 본문이 올바르지 않습니다." }, 400);
  console.error(error);
  return c.json({ message: "서버 오류가 발생했습니다." }, 500);
});

export default app;
