import { describe, expect, it, vi } from "vitest";
import { createQaFetch } from "./qaFixture";
const request = (method: string, body?: unknown) => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });
describe("isolated QA fixture", () => {
  it("does not forward requests or unknown writes", async () => {
    const qaFetch = createQaFetch();
    const spy = vi.spyOn(globalThis, "fetch");
    try {
      expect((await qaFetch("https://example.com/api/todos")).status).toBe(403);
      expect((await qaFetch("/api/unknown", { method: "POST" })).status).toBe(501);
      expect((await qaFetch("/api/unknown")).status).toBe(501);
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
  it("creates, completes, trashes and restores a fixture Todo", async () => {
    const qaFetch = createQaFetch();
    expect(await (await qaFetch("/api/auth/session")).json()).toEqual({ authenticated: true, username: "QA fixture" });
    const created = await qaFetch("/api/offline/todos/test-id", request("PUT", { title: "QA 새 작업", workflowStatus: "TODO" }));
    expect(created.status).toBe(201);
    expect((await (await qaFetch("/api/todos/test-id/completion", request("PUT", { completed: true }))).json()).todo.completed).toBe(true);
    const deleted = await (await qaFetch("/api/todos/test-id/trash", request("POST"))).json();
    expect((await qaFetch("/api/todos/test-id")).status).toBe(404);
    expect((await (await qaFetch("/api/trash/todos/" + deleted.trashId + "/restore", request("POST"))).json()).todoId).toBe("test-id");
    expect((await (await qaFetch("/api/todos/test-id")).json()).todo.title).toBe("QA 새 작업");
    expect((await createQaFetch()("/api/todos/test-id")).status).toBe(404);
  });
  it("creates and links memo without mutating scratchpad", async () => {
    const qaFetch = createQaFetch();
    const before = await (await qaFetch("/api/scratchpad")).json();
    const created = await (await qaFetch("/api/memos", request("POST", { content: "copied" }))).json();
    const linked = await (await qaFetch("/api/memos/" + created.memo.id + "/links", request("PUT", { todoIds: ["qa-todo-1"], projectIds: ["qa-project"] }))).json();
    expect(linked.memo.todoIds).toEqual(["qa-todo-1"]);
    expect(await (await qaFetch("/api/scratchpad")).json()).toEqual(before);
  });
  it("simulates a single running timer and splits at 03:00 KST", async () => {
    let now = Date.parse("2026-11-24T17:50:00Z");
    const qaFetch = createQaFetch(() => now);
    await qaFetch("/api/timer/start", request("POST", { todoId: "qa-todo-1" }));
    now += 20 * 60_000;
    const stopped = await (await qaFetch("/api/timer/stop", request("POST"))).json();
    expect(stopped.timeEntries.map((entry: { plannerDate: string; durationMinutes: number }) => [entry.plannerDate, entry.durationMinutes])).toEqual([["2026-11-24", 10], ["2026-11-25", 10]]);
    expect(stopped.activeTimer).toBeNull();
  });
  it("records manual project and Todo time with their target identifiers", async () => {
    const qaFetch = createQaFetch(() => Date.parse("2026-11-24T12:00:00Z"));
    const times = { startedAt: "2026-11-24T09:00:00Z", endedAt: "2026-11-24T10:00:00Z" };
    const project = await (await qaFetch("/api/time-entries", request("POST", { ...times, projectId: "qa-project" }))).json();
    expect(project.timeEntries[0]).toMatchObject({ projectId: "qa-project", title: "QA 프로젝트" });
    const todo = await (await qaFetch("/api/time-entries", request("POST", { ...times, todoId: "qa-todo-1" }))).json();
    expect(todo.timeEntries[0]).toMatchObject({ todoId: "qa-todo-1", projectId: "qa-project", categoryId: "qa-study" });
  });
  it("provides GitHub sample rows without network", async () => {
    const qaFetch = createQaFetch();
    expect((await (await qaFetch("/api/github/repositories/qa-example/demo/pulls?state=open")).json()).items[0].number).toBe(12);
    expect((await qaFetch("/api/github/repositories/real/repo/pulls")).status).toBe(501);
  });
});
