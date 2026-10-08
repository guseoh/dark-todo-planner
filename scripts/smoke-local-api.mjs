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
  console.log("LOCAL E2E PASS: health, auth, idempotent create, update, completion, trash preview and restore.");
} finally {
  if (created) {
    // Only loopback URLs can reach this cleanup path.
    const cleanup = await request(`/api/todos/${id}/trash`, "POST").catch(() => undefined);
    if (cleanup?.data?.trashId) await request(`/api/trash/todos/${cleanup.data.trashId}`, "DELETE");
  }
}
