import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { z, ZodError } from "zod";
import {
  clearSessionCookie,
  constantTimeTextEqual,
  createSessionToken,
  requireAuth,
  SESSION_COOKIE,
  setSessionCookie,
  verifyPassword,
  verifySessionToken,
} from "./auth";
import { backupV9ExportMiddleware, backupV9ImportMiddleware } from "./backupMiddleware";
import { learningBackupExportMiddleware, learningBackupImportMiddleware } from "./learningBackupMiddleware";
import { runNotionLearningSync } from "./notionLearningSync";
import { todoReferenceTrashRestoreMiddleware } from "./referenceLinkMiddleware";
import { runDiscordIncompleteTodoReminder } from "./reminders/incompleteTodoReminder";
import { backupRoutes } from "./routes/backup";
import { contentRoutes } from "./routes/content";
import { learningRoutes } from "./routes/learning";
import { libraryRoutes } from "./routes/library";
import { planningRoutes } from "./routes/planning";
import { projectDuplicateRoutes } from "./routes/projectDuplicate";
import { projectRoutes } from "./routes/projects";
import { referenceLinkRoutes } from "./routes/referenceLinks";
import { scratchpadRoutes } from "./routes/scratchpad";
import { settingsRoutes } from "./routes/settings";
import { timeRoutes } from "./routes/time";
import { todoRoutes } from "./routes/todos";
import { trashRoutes } from "./routes/trash";
import {
  clientIdentifier,
  enforceSameOriginMutations,
  preventApiCaching,
  SAFE_METHODS,
  securityHeaders,
  tooManyRequests,
} from "./security";
import type { Bindings, Variables } from "./types";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const loginSchema = z.object({ username: z.string().min(1).max(256), password: z.string().min(1).max(1024) });

app.use("*", securityHeaders);
app.use("/api/*", preventApiCaching);
app.use("/api/*", enforceSameOriginMutations);
app.use("/api/*", async (c, next) => {
  const publicPaths = ["/api/health", "/api/auth/login", "/api/auth/logout", "/api/auth/session"];
  if (publicPaths.includes(c.req.path)) return next();
  return requireAuth(c, next);
});
app.use("/api/*", async (c, next) => {
  const publicPath = c.req.path === "/api/health" || c.req.path.startsWith("/api/auth/");
  if (SAFE_METHODS.has(c.req.method) || publicPath) return next();
  const { success } = await c.env.MUTATION_RATE_LIMITER.limit({ key: c.get("userId") });
  if (!success) return tooManyRequests(c);
  return next();
});
app.use("/api/trash/todos/*", todoReferenceTrashRestoreMiddleware);

app.get("/api/health", async (c) => {
  await c.env.DB.prepare("SELECT 1").first();
  return c.json({ status: "ok", database: "connected" });
});

app.post("/api/auth/login", async (c) => {
  const { success } = await c.env.LOGIN_RATE_LIMITER.limit({ key: clientIdentifier(c.req.raw) });
  if (!success) return tooManyRequests(c);
  if (!c.env.AUTH_USERNAME || !c.env.AUTH_PASSWORD_HASH || !c.env.SESSION_SECRET || c.env.SESSION_SECRET.length < 32) {
    return c.json({ message: "인증 Secret이 올바르게 설정되지 않았습니다." }, 503);
  }

  const input = loginSchema.parse(await c.req.json());
  const validPassword = await verifyPassword(input.password, c.env.AUTH_PASSWORD_HASH);
  const validUsername = constantTimeTextEqual(input.username, c.env.AUTH_USERNAME);
  if (!validUsername || !validPassword) return c.json({ message: "사용자명 또는 비밀번호가 올바르지 않습니다." }, 401);

  setSessionCookie(c, await createSessionToken(c.env.SESSION_SECRET, c.env.AUTH_PASSWORD_HASH));
  return c.json({ authenticated: true, username: c.env.AUTH_USERNAME });
});

app.post("/api/auth/logout", (c) => {
  clearSessionCookie(c);
  return c.json({ authenticated: false });
});

app.get("/api/auth/session", async (c) => {
  const authenticated = await verifySessionToken(
    getCookie(c, SESSION_COOKIE),
    c.env.SESSION_SECRET || "",
    c.env.AUTH_PASSWORD_HASH || "",
  );
  return c.json(authenticated ? { authenticated: true, username: c.env.AUTH_USERNAME } : { authenticated: false }, authenticated ? 200 : 401);
});

app.use("/api/backup/export", learningBackupExportMiddleware);
app.use("/api/backup/import", learningBackupImportMiddleware);
app.use("/api/migrate/local-storage", learningBackupImportMiddleware);
app.use("/api/backup/export", backupV9ExportMiddleware);
app.use("/api/backup/import", backupV9ImportMiddleware);
app.use("/api/migrate/local-storage", backupV9ImportMiddleware);

app.route("/api", todoRoutes);
app.route("/api", projectRoutes);
app.route("/api", projectDuplicateRoutes);
app.route("/api", referenceLinkRoutes);
app.route("/api", contentRoutes);
app.route("/api", learningRoutes);
app.route("/api", planningRoutes);
app.route("/api", timeRoutes);
app.route("/api", settingsRoutes);
app.route("/api", scratchpadRoutes);
app.route("/api", trashRoutes);
app.route("/api", libraryRoutes);
app.route("/api", backupRoutes);

app.notFound((c) => c.req.path.startsWith("/api/") ? c.json({ message: "API 경로를 찾을 수 없습니다." }, 404) : c.env.ASSETS.fetch(c.req.raw));
app.onError((error, c) => {
  if (error instanceof ZodError) return c.json({ message: "입력값이 올바르지 않습니다.", issues: error.issues }, 400);
  if (error instanceof SyntaxError) return c.json({ message: "JSON 요청 본문이 올바르지 않습니다." }, 400);
  console.error(error);
  return c.json({ message: "서버 오류가 발생했습니다." }, 500);
});

export default {
  fetch: (request: Request, env: Bindings, executionContext: ExecutionContext) => app.fetch(request, env, executionContext),
  scheduled: (controller: ScheduledController, env: Bindings, executionContext: ExecutionContext) => {
    const jobs: Promise<unknown>[] = [runNotionLearningSync(env, new Date(controller.scheduledTime))];
    if (controller.cron === "0 12 * * *") jobs.push(runDiscordIncompleteTodoReminder(env, new Date(controller.scheduledTime)));
    executionContext.waitUntil(Promise.allSettled(jobs).then(() => undefined));
  },
} satisfies ExportedHandler<Bindings>;
