import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

const baseUrl = new URL(process.env.SMOKE_BASE_URL || "http://127.0.0.1:8787");
if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(baseUrl.hostname) || !["http:", "https:"].includes(baseUrl.protocol)) {
  throw new Error("Local API smoke must never target Preview/Production or a non-loopback host.");
}
if (!process.env.SMOKE_USERNAME || !process.env.SMOKE_PASSWORD) throw new Error("Missing isolated smoke credentials.");
let cookie = "";
const url = (path) => new URL(path, baseUrl).toString();
const request = async (path, method = "GET", body) => {
  const headers = { Origin: baseUrl.origin, ...(cookie ? { Cookie: cookie } : {}) };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(url(path), { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch { throw new Error(`Non-JSON response for ${method} ${path}: HTTP ${response.status}`); }
  }
  return { response, data };
};
const expectStatus = (result, status, description) => {
  assert.equal(result.response.status, status, `${description}: expected HTTP ${status}, got ${result.response.status}: ${JSON.stringify(result.data).slice(0, 220)}`);
  return result.data;
};

// Local Worker startup and D1 migrations can take some seconds.
let ready = false;
for (let attempt = 0; attempt < 50; attempt += 1) {
  try {
    const health = await request("/api/health");
    if (health.response.ok && health.data.status === "ok" && health.data.database === "connected") {
      ready = true;
      break;
    }
  } catch { /* Worker not listening yet. */ }
  await sleep(1000);
}
assert.ok(ready, "Local Worker did not become healthy. Check wrangler dev and local D1 migrations.");

expectStatus(await request("/api/todos"), 401, "Unauthorized Todo list");
const login = await request("/api/auth/login", "POST", { username: process.env.SMOKE_USERNAME, password: process.env.SMOKE_PASSWORD });
expectStatus(login, 200, "Sign-in");
cookie = login.response.headers.get("set-cookie")?.split(";")[0] || "";
assert.ok(cookie.startsWith("__Host-dtp_session="), "Secure session cookie is missing.");

const id = randomUUID();
const today = "2026-10-08";
const input = { title: "Local E2E " + id.slice(0, 8), date: today, planningState: "SCHEDULED", workflowStatus: "TODO", priority: "MEDIUM" };
let created = false;
try {
  const inserted = expectStatus(await request(`/api/offline/todos/${id}`, "PUT", input), 201, "Idempotent UUID Todo create");
  assert.equal(inserted.todo.id, id);
  created = true;

  const repeated = expectStatus(await request(`/api/offline/todos/${id}`, "PUT", input), 200, "Duplicate UUID create replay");
  assert.equal(repeated.todo.id, id);

  // Destructive import must reject incomplete v13 JSON before touching any row.
  const exportData = expectStatus(await request("/api/backup/export"), 200, "Export full local JSON");
  assert.equal(exportData.version, 13);
  assert.ok(Array.isArray(exportData.goals) && Array.isArray(exportData.routineRuns));
  const beforeRejectedImport = expectStatus(await request(`/api/todos/${id}`), 200, "Read Todo before rejected import").todo;
  const invalidExport = { ...exportData };
  delete invalidExport.goals;
  expectStatus(await request("/api/backup/import", "POST", invalidExport), 400, "Reject incomplete version 13 backup");
  expectStatus(await request("/api/backup/import", "POST", { ...exportData, todos: [{ id }] }), 400, "Reject invalid Todo record");
  expectStatus(await request("/api/backup/import", "POST", { ...exportData, version: 12 }), 400, "Reject legacy replacement");
  assert.equal(expectStatus(await request(`/api/todos/${id}`), 200, "Verify failed import did not change D1").todo.title, beforeRejectedImport.title);

  const update = { ...input, title: "Edited local Todo", referenceUrl: "https://example.com/reference", referenceLabel: "Reference" };
  const updated = expectStatus(await request(`/api/todos/${id}`, "PUT", update), 200, "Todo and reference link update");
  assert.equal(updated.todo.title, update.title);
  assert.equal(updated.todo.referenceUrl, update.referenceUrl);

  const complete = expectStatus(await request(`/api/todos/${id}/completion`, "PUT", { completed: true }), 200, "Todo completion");
  assert.equal(complete.todo.completed, true);
  assert.equal(expectStatus(await request(`/api/todos/${id}`), 200, "Fetch updated Todo").todo.completed, true);

  const moved = expectStatus(await request(`/api/todos/${id}/trash`, "POST"), 200, "Move Todo to trash");
  assert.ok(moved.trashId, "Trash ID missing");
  expectStatus(await request(`/api/todos/${id}`), 404, "Todo absent after trash");
  const preview = expectStatus(await request(`/api/trash/todos/${moved.trashId}/preview`), 200, "Trash restore preview");
  assert.equal(preview.preview.restorable, true, "Newly trashed Todo should be restorable");

  const restored = expectStatus(await request(`/api/trash/todos/${moved.trashId}/restore`, "POST"), 200, "Restore Todo");
  assert.equal(restored.todoId, id);
  assert.equal(expectStatus(await request(`/api/todos/${id}`), 200, "Restored Todo").todo.title, update.title);
  // Only the disposable local D1 can execute a valid destructive restore test.
  const validExport = expectStatus(await request("/api/backup/export"), 200, "Export local pre-restore snapshot");
  const imported = expectStatus(await request("/api/backup/import", "POST", validExport), 200, "Restore locally exported backup");
  assert.equal(imported.ok, true);
  const restoredAfterImport = expectStatus(await request(`/api/todos/${id}`), 200, "Verify real local JSON round trip").todo;
  assert.equal(restoredAfterImport.title, update.title);
  assert.equal(restoredAfterImport.referenceUrl, update.referenceUrl);

  // Force a database error in the LATE routine phase of an otherwise valid
  // v13 restore. Every prior Todo/extension write must be rolled back too.
  const beforeAtomicFailure = expectStatus(await request("/api/backup/export"), 200, "Backup before induced D1 error");
  const modifiedTitle = "THIS MUST NEVER COMMIT";
  const doomed = {
    ...beforeAtomicFailure,
    todos: beforeAtomicFailure.todos.map((todo) => todo.id === id ? { ...todo, title: modifiedTitle } : todo),
    routineTemplates: [
      ...beforeAtomicFailure.routineTemplates,
      { id: randomUUID(), name: "__ATOMIC_RESTORE_FAIL__", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ],
  };
  expectStatus(await request("/api/backup/import", "POST", doomed), 500, "Late SQL error rolls back entire JSON import");
  const afterAtomicFailure = expectStatus(await request(`/api/todos/${id}`), 200, "Read Todo after failed transaction").todo;
  assert.equal(afterAtomicFailure.title, update.title, "Earlier core writes must be rolled back after late routine insert failure");
  assert.equal(afterAtomicFailure.referenceUrl, update.referenceUrl);
  const afterBackup = expectStatus(await request("/api/backup/export"), 200, "Backup after induced rollback");
  assert.deepEqual(afterBackup.routineTemplates, beforeAtomicFailure.routineTemplates, "Late routine phase must leave no partially changed routines");

  const planPath = "/api/daily-plans/" + today;
  const focus = expectStatus(await request(planPath, "PUT", { topTodoIds: [id] }), 200, "Persist Today focus");
  assert.deepEqual(focus.dailyPlan.topTodoIds, [id]);
  const { dailyPlans } = expectStatus(await request("/api/daily-plans?date=" + today), 200, "Reload Today focus");
  assert.deepEqual(dailyPlans[0].topTodoIds, [id]);
  expectStatus(await request(planPath, "PUT", { topTodoIds: [] }), 200, "Clear Today focus");

  const blockDate = "2099-11-13";
  const blockInput = { title: "Local time block", todoId: id, date: blockDate, startTime: "09:00", endTime: "10:00", scheduleTodo: true };
  expectStatus(await request("/api/time-blocks", "POST", { ...blockInput, endTime: "08:30" }), 400, "Reject reversed time block");
  assert.equal(expectStatus(await request("/api/todos/" + id), 200, "Check date after rejected time block").todo.date, today);
  const { timeBlock } = expectStatus(await request("/api/time-blocks", "POST", blockInput), 201, "Save time block and schedule Todo");
  assert.equal(expectStatus(await request("/api/todos/" + id), 200, "Check date after saving time block").todo.date, blockDate);
  const { timeBlocks } = expectStatus(await request("/api/time-blocks?date=" + blockDate), 200, "Reload time block");
  assert.ok(timeBlocks.some((block) => block.id === timeBlock.id));
  expectStatus(await request("/api/time-blocks/" + timeBlock.id, "DELETE"), 200, "Remove isolated time block");

  // Time tracking: one running timer, accidental taps are dropped, and entries split at 03:00 KST.
  expectStatus(await request("/api/timer/start", "POST", { todoId: id }), 200, "Start timer");
  assert.equal(expectStatus(await request("/api/timer"), 200, "Read running timer").activeTimer.todoId, id);
  assert.equal(expectStatus(await request("/api/timer/stop", "POST"), 200, "Stop timer immediately").discarded, true, "Sub-30s timers are discarded.");
  assert.equal(expectStatus(await request("/api/timer"), 200, "Timer cleared after stop").activeTimer, null);
  const night = expectStatus(await request("/api/time-entries", "POST", {
    title: "Local night session", startedAt: "2025-01-01T13:00:00.000Z", endedAt: "2025-01-01T20:00:00.000Z",
  }), 201, "Create entry crossing the 03:00 KST planner-day boundary").timeEntries;
  assert.deepEqual(night.map((entry) => [entry.plannerDate, entry.durationMinutes]), [["2025-01-01", 300], ["2025-01-02", 120]]);
  expectStatus(await request("/api/time-entries", "POST", {
    title: "Future", startedAt: new Date(Date.now() + 3_600_000).toISOString(), endedAt: new Date(Date.now() + 7_200_000).toISOString(),
  }), 400, "Reject future time entry");
  expectStatus(await request("/api/time-entries/" + night[0].id, "PUT", { startedAt: "2025-01-01T13:00:00.000Z", endedAt: "2025-01-01T20:00:00.000Z" }), 400, "Reject edit across 03:00 KST");
  const listed = expectStatus(await request("/api/time-entries?from=2025-01-01&to=2025-01-02"), 200, "List entries by planner date").timeEntries;
  assert.equal(listed.filter((entry) => entry.title === "Local night session").length, 2);
  for (const entry of night) expectStatus(await request("/api/time-entries/" + entry.id, "DELETE"), 200, "Remove isolated time entry");

  // Project deletion, saved preferences (time goal + kanban WIP limits), daily reflection and per-project time totals.
  const created1 = expectStatus(await request("/api/projects", "POST", { name: "Local delete project", status: "ACTIVE" }), 201, "Create project to delete").project;
  expectStatus(await request("/api/projects/" + created1.id, "DELETE"), 200, "Delete project");
  assert.equal(expectStatus(await request("/api/projects"), 200, "List projects after delete").projects.some((item) => item.id === created1.id), false);
  expectStatus(await request("/api/projects/" + created1.id, "DELETE"), 404, "Deleting a missing project is a 404");

  const tracked = expectStatus(await request("/api/projects", "POST", { name: "Local tracked project", status: "ACTIVE" }), 201, "Create tracked project").project;
  const prefs = expectStatus(await request("/api/planner-settings", "PATCH", { dailyGoalMinutes: 240, wipLimits: { [tracked.id]: { TODO: 3 } } }), 200, "Save preferences").plannerSettings;
  assert.equal(prefs.dailyGoalMinutes, 240);
  assert.deepEqual(prefs.wipLimits[tracked.id], { TODO: 3 });
  expectStatus(await request("/api/planner-settings", "PATCH", { wipLimits: { [tracked.id]: { TODO: 0 } } }), 400, "Reject a zero WIP limit");
  expectStatus(await request("/api/planner-settings", "PATCH", {}), 400, "Reject an empty preferences patch");
  assert.equal(expectStatus(await request("/api/planner-settings"), 200, "Reload settings").plannerSettings.dailyGoalMinutes, 240);
  expectStatus(await request("/api/planner-settings", "PATCH", { dailyGoalMinutes: 0, wipLimits: {} }), 200, "Reset preferences");

  expectStatus(await request("/api/reflections/daily/2025-01-03", "PUT", { content: "Local reflection" }), 200, "Save daily reflection");
  const notes = expectStatus(await request("/api/reflections?from=2025-01-03&to=2025-01-03"), 200, "Read daily reflection").reflections;
  assert.deepEqual(notes.map((note) => note.content), ["Local reflection"]);
  expectStatus(await request("/api/reflections/daily/2025-01-03", "PUT", { content: "" }), 200, "Clear daily reflection");
  assert.equal(expectStatus(await request("/api/reflections?from=2025-01-03&to=2025-01-03"), 200, "Reflection cleared").reflections.length, 0);

  const trackedTodo = expectStatus(await request("/api/todos", "POST", { title: "Local tracked todo", date: today, planningState: "SCHEDULED", projectId: tracked.id }), 201, "Create tracked Todo").todo;
  const hour = expectStatus(await request("/api/time-entries", "POST", { todoId: trackedTodo.id, startedAt: "2025-01-05T01:00:00.000Z", endedAt: "2025-01-05T02:30:00.000Z" }), 201, "Measure time on a project Todo").timeEntries;
  const summary = expectStatus(await request("/api/time-summary?from=2025-01-05&to=2025-01-05"), 200, "Summarize time by project");
  assert.equal(summary.byProject.find((row) => row.projectId === tracked.id)?.minutes, 90);
  for (const entry of hour) expectStatus(await request("/api/time-entries/" + entry.id, "DELETE"), 200, "Remove tracked entry");
  expectStatus(await request("/api/todos/" + trackedTodo.id, "DELETE"), 200, "Remove tracked Todo");
  expectStatus(await request("/api/projects/" + tracked.id, "DELETE"), 200, "Remove tracked project");

  console.log("LOCAL E2E PASS: auth, CRUD, trash recovery, atomic backup, Today focus, time block scheduling, time tracking, project deletion, preferences, and reflections.");
} finally {
  if (created) {
    // Only loopback URLs can reach this cleanup path.
    const cleanup = await request(`/api/todos/${id}/trash`, "POST").catch(() => undefined);
    if (cleanup?.data?.trashId) await request(`/api/trash/todos/${cleanup.data.trashId}`, "DELETE");
  }
}
