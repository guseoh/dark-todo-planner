import "dotenv/config";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { clearSessionCookie, requireAuth, setSessionCookie, signSession, toSafeUser, type AuthenticatedRequest } from "./auth";
import { importBackupForUser } from "./backup";
import { prisma } from "./db";
import {
  serializeCategory,
  serializeFocusSession,
  serializeGoal,
  serializeReflection,
  serializeTimerSettings,
  serializeTodo,
} from "./serializers";
import {
  categoryInputSchema,
  focusSessionInputSchema,
  goalInputSchema,
  reflectionInputSchema,
  timerSettingsInputSchema,
  todoInputSchema,
} from "./validation";

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
const clientUrl = process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(express.json({ limit: "4mb" }));
app.use(cookieParser());

if (!isProduction) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || origin === clientUrl) {
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
      }
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  });
}

const asyncHandler =
  <TReq extends Request = Request>(handler: (req: TReq, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) => {
    Promise.resolve(handler(req as TReq, res)).catch((error) => {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력값이 올바르지 않습니다.", issues: error.issues });
      }
      console.error(error);
      return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    });
  };

const paramId = (req: Request) => String(req.params.id);

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nickname: z.string().optional(),
});

const defaultTimerSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  soundEnabled: true,
  notificationEnabled: false,
};

const normalizeOptional = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const parseTags = (tags?: unknown) =>
  Array.isArray(tags)
    ? Array.from(new Set(tags.map((tag) => String(tag).trim().replace(/^#/, "")).filter(Boolean)))
    : [];

const syncTodoTags = async (userId: string, todoId: string, tags: string[]) => {
  await prisma.todoTag.deleteMany({ where: { todoId } });
  for (const name of tags) {
    const tag = await prisma.tag.upsert({
      where: { userId_name: { userId, name } },
      update: {},
      create: { userId, name },
    });
    await prisma.todoTag.create({ data: { todoId, tagId: tag.id } });
  }
};

const todoInclude = {
  category: true,
  todoTags: { include: { tag: true } },
} as const;

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: "ok", database: "connected" });
  }),
);

app.post(
  "/api/auth/register",
  asyncHandler(async (req, res) => {
    const input = authSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) return res.status(409).json({ message: "이미 가입된 이메일입니다." });

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        nickname: input.nickname?.trim() || undefined,
        timerSettings: { create: defaultTimerSettings },
      },
    });
    setSessionCookie(res, signSession(user.id));
    return res.status(201).json({ user: toSafeUser(user) });
  }),
);

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const input = authSchema.omit({ nickname: true }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });

    setSessionCookie(res, signSession(user.id));
    return res.json({ user: toSafeUser(user) });
  }),
);

app.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get(
  "/api/auth/me",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    return res.json({ user: toSafeUser(user) });
  }),
);

app.get(
  "/api/categories",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { userId: req.userId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return res.json({ categories: categories.map(serializeCategory) });
  }),
);

app.post(
  "/api/categories",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const input = categoryInputSchema.parse(req.body);
    const max = await prisma.category.aggregate({ where: { userId: req.userId }, _max: { order: true } });
    const category = await prisma.category.create({
      data: {
        userId: req.userId,
        name: input.name,
        description: normalizeOptional(input.description),
        color: input.color || "#6366f1",
        order: input.order ?? (max._max.order ?? -1) + 1,
      },
    });
    return res.status(201).json({ category: serializeCategory(category) });
  }),
);

app.get(
  "/api/categories/:id",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const category = await prisma.category.findFirst({ where: { id: paramId(req), userId: req.userId } });
    if (!category) return res.status(404).json({ message: "카테고리를 찾을 수 없습니다." });
    return res.json({ category: serializeCategory(category) });
  }),
);

app.put(
  "/api/categories/:id",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const input = categoryInputSchema.parse(req.body);
    const exists = await prisma.category.findFirst({ where: { id: paramId(req), userId: req.userId } });
    if (!exists) return res.status(404).json({ message: "카테고리를 찾을 수 없습니다." });
    const category = await prisma.category.update({
      where: { id: paramId(req) },
      data: {
        name: input.name,
        description: normalizeOptional(input.description),
        color: input.color || "#6366f1",
        order: input.order ?? exists.order,
      },
    });
    return res.json({ category: serializeCategory(category) });
  }),
);

app.delete(
  "/api/categories/:id",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const mode = req.query.mode === "deleteTodos" ? "deleteTodos" : "moveTodos";
    const category = await prisma.category.findFirst({ where: { id: paramId(req), userId: req.userId } });
    if (!category) return res.status(404).json({ message: "카테고리를 찾을 수 없습니다." });
    if (mode === "deleteTodos") await prisma.todo.deleteMany({ where: { userId: req.userId, categoryId: category.id } });
    else await prisma.todo.updateMany({ where: { userId: req.userId, categoryId: category.id }, data: { categoryId: null } });
    await prisma.category.delete({ where: { id: category.id } });
    return res.json({ ok: true });
  }),
);

app.patch(
  "/api/categories/reorder",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const input = z.object({ ids: z.array(z.string()) }).parse(req.body);
    await prisma.$transaction(
      input.ids.map((id, order) =>
        prisma.category.updateMany({ where: { id, userId: req.userId }, data: { order } }),
      ),
    );
    return res.json({ ok: true });
  }),
);

app.get(
  "/api/categories/:id/todos",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const categoryId = paramId(req) === "uncategorized" ? null : paramId(req);
    const todos = await prisma.todo.findMany({
      where: { userId: req.userId, categoryId },
      include: todoInclude,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
    return res.json({ todos: todos.map(serializeTodo) });
  }),
);

const buildTodoWhere = (req: AuthenticatedRequest) => {
  const { categoryId, date, from, to, completed, priority, keyword, archived } = req.query;
  const where: Record<string, unknown> = { userId: req.userId };
  if (categoryId === "uncategorized") where.categoryId = null;
  else if (typeof categoryId === "string" && categoryId) where.categoryId = categoryId;
  if (typeof date === "string" && date) where.date = date;
  if (typeof from === "string" || typeof to === "string") {
    where.date = {
      ...(typeof from === "string" && from ? { gte: from } : {}),
      ...(typeof to === "string" && to ? { lte: to } : {}),
    };
  }
  if (completed === "true" || completed === "false") where.completed = completed === "true";
  if (priority === "LOW" || priority === "MEDIUM" || priority === "HIGH") where.priority = priority;
  if (archived === "true" || archived === "false") where.archived = archived === "true";
  if (typeof keyword === "string" && keyword.trim()) {
    where.OR = [
      { title: { contains: keyword } },
      { memo: { contains: keyword } },
      { category: { name: { contains: keyword } } },
      { todoTags: { some: { tag: { name: { contains: keyword } } } } },
    ];
  }
  return where;
};

app.get(
  "/api/todos",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const todos = await prisma.todo.findMany({
      where: buildTodoWhere(req),
      include: todoInclude,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
    return res.json({ todos: todos.map(serializeTodo) });
  }),
);

app.post(
  "/api/todos",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const input = todoInputSchema.parse(req.body);
    if (input.categoryId) {
      const category = await prisma.category.findFirst({ where: { id: input.categoryId, userId: req.userId } });
      if (!category) return res.status(400).json({ message: "카테고리를 찾을 수 없습니다." });
    }
    const max = await prisma.todo.aggregate({ where: { userId: req.userId, categoryId: input.categoryId || null }, _max: { order: true } });
    const todo = await prisma.todo.create({
      data: {
        userId: req.userId,
        categoryId: input.categoryId || null,
        title: input.title,
        memo: normalizeOptional(input.memo),
        date: input.date,
        startTime: normalizeOptional(input.startTime),
        endTime: normalizeOptional(input.endTime),
        priority: input.priority,
        completed: input.completed || false,
        repeat: input.repeat,
        archived: input.archived || false,
        order: input.order ?? (max._max.order ?? -1) + 1,
      },
    });
    await syncTodoTags(req.userId, todo.id, input.tags);
    const withRelations = await prisma.todo.findUniqueOrThrow({ where: { id: todo.id }, include: todoInclude });
    return res.status(201).json({ todo: serializeTodo(withRelations) });
  }),
);

app.get(
  "/api/todos/:id",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const todo = await prisma.todo.findFirst({ where: { id: paramId(req), userId: req.userId }, include: todoInclude });
    if (!todo) return res.status(404).json({ message: "Todo를 찾을 수 없습니다." });
    return res.json({ todo: serializeTodo(todo) });
  }),
);

app.put(
  "/api/todos/:id",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const input = todoInputSchema.parse(req.body);
    const exists = await prisma.todo.findFirst({ where: { id: paramId(req), userId: req.userId } });
    if (!exists) return res.status(404).json({ message: "Todo를 찾을 수 없습니다." });
    if (input.categoryId) {
      const category = await prisma.category.findFirst({ where: { id: input.categoryId, userId: req.userId } });
      if (!category) return res.status(400).json({ message: "카테고리를 찾을 수 없습니다." });
    }
    const todo = await prisma.todo.update({
      where: { id: exists.id },
      data: {
        categoryId: input.categoryId || null,
        title: input.title,
        memo: normalizeOptional(input.memo),
        date: input.date,
        startTime: normalizeOptional(input.startTime),
        endTime: normalizeOptional(input.endTime),
        priority: input.priority,
        completed: input.completed ?? exists.completed,
        repeat: input.repeat,
        archived: input.archived ?? exists.archived,
        order: input.order ?? exists.order,
      },
    });
    await syncTodoTags(req.userId, todo.id, input.tags);
    const withRelations = await prisma.todo.findUniqueOrThrow({ where: { id: todo.id }, include: todoInclude });
    return res.json({ todo: serializeTodo(withRelations) });
  }),
);

app.delete(
  "/api/todos/:id",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    await prisma.todo.deleteMany({ where: { id: paramId(req), userId: req.userId } });
    return res.json({ ok: true });
  }),
);

app.patch(
  "/api/todos/:id/toggle",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const todo = await prisma.todo.findFirst({ where: { id: paramId(req), userId: req.userId } });
    if (!todo) return res.status(404).json({ message: "Todo를 찾을 수 없습니다." });
    const updated = await prisma.todo.update({
      where: { id: todo.id },
      data: { completed: !todo.completed },
      include: todoInclude,
    });
    return res.json({ todo: serializeTodo(updated) });
  }),
);

app.patch(
  "/api/todos/:id/archive",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const updated = await prisma.todo.updateMany({
      where: { id: paramId(req), userId: req.userId },
      data: { archived: true, archivedAt: new Date() },
    });
    if (!updated.count) return res.status(404).json({ message: "Todo를 찾을 수 없습니다." });
    const todo = await prisma.todo.findUniqueOrThrow({ where: { id: paramId(req) }, include: todoInclude });
    return res.json({ todo: serializeTodo(todo) });
  }),
);

app.patch(
  "/api/todos/:id/unarchive",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const updated = await prisma.todo.updateMany({
      where: { id: paramId(req), userId: req.userId },
      data: { archived: false, archivedAt: null },
    });
    if (!updated.count) return res.status(404).json({ message: "Todo를 찾을 수 없습니다." });
    const todo = await prisma.todo.findUniqueOrThrow({ where: { id: paramId(req) }, include: todoInclude });
    return res.json({ todo: serializeTodo(todo) });
  }),
);

app.patch(
  "/api/todos/reorder",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const input = z.object({ ids: z.array(z.string()) }).parse(req.body);
    await prisma.$transaction(input.ids.map((id, order) => prisma.todo.updateMany({ where: { id, userId: req.userId }, data: { order } })));
    return res.json({ ok: true });
  }),
);

app.get(
  "/api/reflections",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { type, date } = req.query;
    const reflections = await prisma.reflection.findMany({
      where: {
        userId: req.userId,
        ...(typeof type === "string" ? { type: type as never } : {}),
        ...(typeof date === "string" ? { date } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    return res.json({ reflections: reflections.map(serializeReflection) });
  }),
);

app.post(
  "/api/reflections",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const input = reflectionInputSchema.parse(req.body);
    const reflection = await prisma.reflection.create({
      data: {
        userId: req.userId,
        date: input.date,
        type: input.type,
        content: normalizeOptional(input.content),
        sectionsJson: JSON.stringify(input.sections),
      },
    });
    return res.status(201).json({ reflection: serializeReflection(reflection) });
  }),
);

app.put(
  "/api/reflections/:id",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const input = reflectionInputSchema.parse(req.body);
    const exists = await prisma.reflection.findFirst({ where: { id: paramId(req), userId: req.userId } });
    if (!exists) return res.status(404).json({ message: "회고를 찾을 수 없습니다." });
    const reflection = await prisma.reflection.update({
      where: { id: exists.id },
      data: {
        date: input.date,
        type: input.type,
        content: normalizeOptional(input.content),
        sectionsJson: JSON.stringify(input.sections),
      },
    });
    return res.json({ reflection: serializeReflection(reflection) });
  }),
);

app.delete(
  "/api/reflections/:id",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    await prisma.reflection.deleteMany({ where: { id: paramId(req), userId: req.userId } });
    return res.json({ ok: true });
  }),
);

app.get(
  "/api/goals",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { type, date, weekStartDate, month } = req.query;
    const goals = await prisma.goal.findMany({
      where: {
        userId: req.userId,
        ...(typeof type === "string" ? { type: type as never } : {}),
        ...(typeof date === "string" ? { targetDate: date } : {}),
        ...(typeof weekStartDate === "string" ? { weekStartDate } : {}),
        ...(typeof month === "string" ? { month } : {}),
      },
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });
    return res.json({ goals: goals.map(serializeGoal) });
  }),
);

app.get(
  "/api/goals/:id",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const goal = await prisma.goal.findFirst({ where: { id: paramId(req), userId: req.userId } });
    if (!goal) return res.status(404).json({ message: "목표를 찾을 수 없습니다." });
    return res.json({ goal: serializeGoal(goal) });
  }),
);

app.post(
  "/api/goals",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const input = goalInputSchema.parse(req.body);
    const goal = await prisma.goal.create({
      data: {
        userId: req.userId,
        title: input.title,
        description: normalizeOptional(input.description),
        type: input.type,
        targetDate: normalizeOptional(input.targetDate),
        weekStartDate: normalizeOptional(input.weekStartDate),
        weekEndDate: normalizeOptional(input.weekEndDate),
        month: normalizeOptional(input.month),
        dueDate: normalizeOptional(input.dueDate),
        progress: input.progress,
        completed: input.completed || false,
      },
    });
    return res.status(201).json({ goal: serializeGoal(goal) });
  }),
);

app.put(
  "/api/goals/:id",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const input = goalInputSchema.parse(req.body);
    const exists = await prisma.goal.findFirst({ where: { id: paramId(req), userId: req.userId } });
    if (!exists) return res.status(404).json({ message: "목표를 찾을 수 없습니다." });
    const goal = await prisma.goal.update({
      where: { id: exists.id },
      data: {
        title: input.title,
        description: normalizeOptional(input.description),
        type: input.type,
        targetDate: normalizeOptional(input.targetDate),
        weekStartDate: normalizeOptional(input.weekStartDate),
        weekEndDate: normalizeOptional(input.weekEndDate),
        month: normalizeOptional(input.month),
        dueDate: normalizeOptional(input.dueDate),
        progress: input.progress,
        completed: input.completed ?? exists.completed,
      },
    });
    return res.json({ goal: serializeGoal(goal) });
  }),
);

app.patch(
  "/api/goals/:id/toggle",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const exists = await prisma.goal.findFirst({ where: { id: paramId(req), userId: req.userId } });
    if (!exists) return res.status(404).json({ message: "목표를 찾을 수 없습니다." });
    const goal = await prisma.goal.update({
      where: { id: exists.id },
      data: { completed: !exists.completed, progress: exists.completed ? 0 : 100 },
    });
    return res.json({ goal: serializeGoal(goal) });
  }),
);

app.delete(
  "/api/goals/:id",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    await prisma.goal.deleteMany({ where: { id: paramId(req), userId: req.userId } });
    return res.json({ ok: true });
  }),
);

app.get(
  "/api/focus-sessions",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const sessions = await prisma.focusSession.findMany({ where: { userId: req.userId }, orderBy: { endedAt: "desc" } });
    return res.json({ focusSessions: sessions.map(serializeFocusSession) });
  }),
);

app.post(
  "/api/focus-sessions",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const input = focusSessionInputSchema.parse(req.body);
    if (input.todoId) {
      const todo = await prisma.todo.findFirst({ where: { id: input.todoId, userId: req.userId } });
      if (!todo) return res.status(400).json({ message: "연결할 Todo를 찾을 수 없습니다." });
    }
    const session = await prisma.focusSession.create({
      data: {
        userId: req.userId,
        todoId: input.todoId || null,
        todoTitle: normalizeOptional(input.todoTitle),
        mode: input.mode,
        durationMinutes: input.durationMinutes,
        startedAt: new Date(input.startedAt),
        endedAt: new Date(input.endedAt),
        completed: input.completed,
      },
    });
    return res.status(201).json({ focusSession: serializeFocusSession(session) });
  }),
);

app.get(
  "/api/timer-settings",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const settings = await prisma.timerSettings.upsert({
      where: { userId: req.userId },
      update: {},
      create: { userId: req.userId, ...defaultTimerSettings },
    });
    return res.json({ timerSettings: serializeTimerSettings(settings) });
  }),
);

app.put(
  "/api/timer-settings",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const input = timerSettingsInputSchema.parse(req.body);
    const settings = await prisma.timerSettings.upsert({
      where: { userId: req.userId },
      update: input,
      create: { userId: req.userId, ...input },
    });
    return res.json({ timerSettings: serializeTimerSettings(settings) });
  }),
);

const buildBackup = async (userId: string) => {
  const [categories, todos, reflections, goals, focusSessions, timerSettings] = await Promise.all([
    prisma.category.findMany({ where: { userId }, orderBy: [{ order: "asc" }] }),
    prisma.todo.findMany({ where: { userId }, include: todoInclude }),
    prisma.reflection.findMany({ where: { userId } }),
    prisma.goal.findMany({ where: { userId } }),
    prisma.focusSession.findMany({ where: { userId } }),
    prisma.timerSettings.findUnique({ where: { userId } }),
  ]);
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    categories: categories.map(serializeCategory),
    todos: todos.map(serializeTodo),
    reflections: reflections.map(serializeReflection),
    goals: goals.map(serializeGoal),
    focusSessions: focusSessions.map(serializeFocusSession),
    timerSettings: timerSettings ? serializeTimerSettings(timerSettings) : defaultTimerSettings,
  };
};

app.get(
  "/api/backup/export",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    return res.json(await buildBackup(req.userId));
  }),
);

app.post(
  "/api/backup/import",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    if (!req.body || !Array.isArray(req.body.todos)) return res.status(400).json({ message: "todos 배열이 필요합니다." });
    const version = Number(req.body.version ?? 1);
    if (!Number.isInteger(version) || version < 1 || version > 3) {
      return res.status(400).json({ message: "지원하지 않는 백업 버전입니다." });
    }
    await importBackupForUser(req.userId, req.body);
    return res.json({ ok: true });
  }),
);

app.post(
  "/api/migrate/local-storage",
  requireAuth,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    if (!req.body || !Array.isArray(req.body.todos)) return res.status(400).json({ message: "마이그레이션할 todos 배열이 필요합니다." });
    await importBackupForUser(req.userId, { version: req.body.version || 3, ...req.body });
    return res.json({ ok: true });
  }),
);

const clientDistPath = path.resolve(process.cwd(), "dist");
const githubPagesBasePath = "/dark-todo-planner";

app.use("/api", (_req, res) => {
  return res.status(404).json({ message: "API 경로를 찾을 수 없습니다." });
});

app.use(express.static(clientDistPath));
app.use(githubPagesBasePath, express.static(clientDistPath));

app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
  return res.sendFile(path.join(clientDistPath, "index.html"));
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  return res.status(500).json({ message: "서버 오류가 발생했습니다." });
});

app.listen(port, () => {
  console.log(`Dark Todo Planner listening on http://localhost:${port}`);
});
