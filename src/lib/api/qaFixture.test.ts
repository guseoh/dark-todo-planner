import { describe, expect, it, vi } from "vitest";
import { qaFetch } from "./qaFixture";

describe("isolated QA fixture", () => {
  it("does not forward requests or unknown writes to fetch", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    try {
      expect((await qaFetch("https://example.com/api/todos")).status).toBe(403);
      expect((await qaFetch("/api/todos", { method: "POST" })).status).toBe(501);
      expect((await qaFetch("/api/unknown")).status).toBe(501);
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
  it("returns synthetic session and todos", async () => {
    expect(await (await qaFetch("/api/auth/session")).json()).toEqual({ authenticated: true, username: "QA fixture" });
    expect((await (await qaFetch("/api/todos?limit=100")).json()).todos[0].id).toBe("qa-todo-1");
  });
});
