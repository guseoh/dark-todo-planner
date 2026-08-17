import { Hono } from "hono";
import { deleteLearningItem, findLearningItem, importLearningItems, listLearningItems, updateLearningStatus, convertLearningItemToTodo } from "../learningStore";
import { learningDateSchema, learningImportSchema, learningStatusSchema, learningTodoSchema } from "../learningValidation";
import type { Bindings, Variables } from "../types";

export const learningRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

learningRoutes.get("/learning-items", async (c) => {
  const parsedDate = learningDateSchema.safeParse(c.req.query("date"));
  if (!parsedDate.success) return c.json({ message: "날짜 형식이 올바르지 않습니다." }, 400);
  return c.json({ items: await listLearningItems(c.env, c.get("userId"), parsedDate.data) });
});

learningRoutes.post("/learning-items/import", async (c) => {
  const { items } = learningImportSchema.parse(await c.req.json());
  await importLearningItems(c.env, c.get("userId"), items);
  return c.json({ ok: true, imported: items.length });
});

learningRoutes.patch("/learning-items/:id/status", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  if (!await findLearningItem(c.env, userId, id)) return c.json({ message: "학습 항목을 찾을 수 없습니다." }, 404);
  const { status } = learningStatusSchema.parse(await c.req.json());
  return c.json({ item: await updateLearningStatus(c.env, userId, id, status) });
});

learningRoutes.delete("/learning-items/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  if (!await findLearningItem(c.env, userId, id)) return c.json({ message: "학습 항목을 찾을 수 없습니다." }, 404);
  await deleteLearningItem(c.env, userId, id);
  return c.json({ ok: true });
});

learningRoutes.post("/learning-items/:id/todo", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const item = await findLearningItem(c.env, userId, id);
  if (!item) return c.json({ message: "학습 항목을 찾을 수 없습니다." }, 404);
  const { date } = learningTodoSchema.parse(await c.req.json());
  return c.json(await convertLearningItemToTodo(c.env, userId, item, date));
});
