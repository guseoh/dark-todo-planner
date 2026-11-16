import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapPaths, clearBootstrap, noteMutation, onRevalidated, snapshotAvailable, startBootstrap, takePrimed } from "./bootstrap";
import type { Snapshot, SnapshotStore } from "./snapshot";

const respond = (data: Record<string, unknown>, ok = true) =>
  vi.fn(async () => ({ ok, json: async () => ({ data }) }) as unknown as Response) as unknown as typeof fetch;

afterEach(() => { clearBootstrap(); vi.useRealTimers(); });

describe("bootstrap cache", () => {
  it("answers a matching path once and then falls through to the network", async () => {
    const paths = bootstrapPaths("2026-11-16");
    await startBootstrap(respond({ [paths[0]]: { categories: [1] } }), "2026-11-16");
    expect(await takePrimed(paths[0])).toEqual({ categories: [1] });
    expect(await takePrimed(paths[0])).toBeUndefined();
  });

  it("makes a request for an expected path wait for the in-flight bootstrap", async () => {
    const paths = bootstrapPaths("2026-11-16");
    let release: (value: Response) => void = () => undefined;
    const slow = vi.fn(() => new Promise<Response>((resolve) => { release = resolve; })) as unknown as typeof fetch;
    void startBootstrap(slow, "2026-11-16");
    const waiting = takePrimed(paths[1]);
    release({ ok: true, json: async () => ({ data: { [paths[1]]: { todos: [] } } }) } as unknown as Response);
    expect(await waiting).toEqual({ todos: [] });
  });

  it("does not delay or answer paths that were not bootstrapped", async () => {
    await startBootstrap(respond({}), "2026-11-16");
    expect(await takePrimed("/api/trash/todos")).toBeUndefined();
  });

  it("falls back silently when the bootstrap fails", async () => {
    const paths = bootstrapPaths("2026-11-16");
    await startBootstrap(respond({ [paths[0]]: {} }, false), "2026-11-16");
    expect(await takePrimed(paths[0])).toBeUndefined();
    await startBootstrap(vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch, "2026-11-16");
    expect(await takePrimed(paths[0])).toBeUndefined();
  });

  it("drops answers older than the freshness window", async () => {
    vi.useFakeTimers();
    const paths = bootstrapPaths("2026-11-16");
    await startBootstrap(respond({ [paths[0]]: { categories: [] } }), "2026-11-16");
    vi.advanceTimersByTime(31_000);
    expect(await takePrimed(paths[0])).toBeUndefined();
  });

  it("ages the server clock so timer offsets stay correct", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T10:00:00.000Z"));
    const timerPath = "/api/timer";
    await startBootstrap(respond({ [timerPath]: { activeTimer: null, serverNow: "2026-11-16T10:00:00.000Z" } }), "2026-11-16");
    vi.advanceTimersByTime(2_000);
    const result = await takePrimed<{ serverNow: string }>(timerPath);
    expect(result?.serverNow).toBe("2026-11-16T10:00:02.000Z");
  });
});

const memoryStore = (initial: Snapshot | null = null) => {
  const state = { current: initial, cleared: 0 };
  const store: SnapshotStore = {
    read: async () => state.current,
    write: async (snapshot) => { state.current = snapshot; },
    clear: async () => { state.current = null; state.cleared += 1; },
  };
  return { state, store };
};
const snapshotOf = (data: Record<string, unknown>): Snapshot => ({ savedAt: Date.now(), date: "2026-11-16", data });
const deferred = () => {
  let resolve: (value: Response) => void = () => undefined;
  const fetcher = vi.fn(() => new Promise<Response>((done) => { resolve = done; })) as unknown as typeof fetch;
  return { fetcher, answer: (data: Record<string, unknown>, status = 200) => resolve({ ok: status === 200, status, json: async () => ({ data }) } as unknown as Response) };
};
const flush = () => new Promise((done) => setTimeout(done, 0));

describe("snapshot, stale first", () => {
  const paths = bootstrapPaths("2026-11-16");
  const [categories, todos, , , timerPath] = paths;

  it("serves the saved answer before the network answers", async () => {
    const { store } = memoryStore(snapshotOf({ [todos]: { todos: ["old"] } }));
    const network = deferred();
    void startBootstrap(network.fetcher, "2026-11-16", store);
    expect(await snapshotAvailable()).toBe(true);
    expect(await takePrimed(todos)).toEqual({ todos: ["old"] });
  });

  it("never serves live state (running timer) from the snapshot", async () => {
    const { store } = memoryStore(snapshotOf({ [timerPath]: { activeTimer: { todoTitle: "old" } }, [todos]: { todos: [] } }));
    const network = deferred();
    void startBootstrap(network.fetcher, "2026-11-16", store);
    await snapshotAvailable();
    const waiting = takePrimed(timerPath);
    network.answer({ [timerPath]: { activeTimer: null, serverNow: new Date().toISOString() } });
    expect(await waiting).toMatchObject({ activeTimer: null });
  });

  it("tells listeners to reload when the fresh answer differs, and hands them the fresh data", async () => {
    const { store, state } = memoryStore(snapshotOf({ [todos]: { todos: ["old"] }, [categories]: { categories: [] } }));
    const network = deferred();
    const seen = vi.fn();
    const stop = onRevalidated(seen);
    const request = startBootstrap(network.fetcher, "2026-11-16", store);
    await snapshotAvailable();
    await takePrimed(todos); await takePrimed(categories);
    network.answer({ [todos]: { todos: ["new"] }, [categories]: { categories: [] } });
    await request;
    expect(seen).toHaveBeenCalledTimes(1);
    expect(await takePrimed(todos)).toEqual({ todos: ["new"] });
    expect(await takePrimed(categories)).toBeUndefined();
    expect(state.current?.data[todos]).toEqual({ todos: ["new"] });
    stop();
  });

  it("stays quiet when the fresh answer matches what was shown", async () => {
    const { store } = memoryStore(snapshotOf({ [todos]: { todos: ["same"] } }));
    const network = deferred();
    const seen = vi.fn();
    const stop = onRevalidated(seen);
    const request = startBootstrap(network.fetcher, "2026-11-16", store);
    await snapshotAvailable();
    await takePrimed(todos);
    network.answer({ [todos]: { todos: ["same"] } });
    await request;
    expect(seen).not.toHaveBeenCalled();
    stop();
  });

  it("does not trust a fresh answer that a user write may have raced", async () => {
    const { store, state } = memoryStore(snapshotOf({ [todos]: { todos: ["old"] } }));
    const network = deferred();
    const seen = vi.fn();
    const stop = onRevalidated(seen);
    const request = startBootstrap(network.fetcher, "2026-11-16", store);
    await snapshotAvailable();
    await takePrimed(todos);
    noteMutation();
    network.answer({ [todos]: { todos: ["predates the write"] } });
    await request;
    expect(seen).toHaveBeenCalledTimes(1);
    expect(await takePrimed(todos)).toBeUndefined();
    expect(state.current?.data[todos]).toEqual({ todos: ["old"] });
    stop();
  });

  it("forgets the snapshot when the session is gone", async () => {
    const { store, state } = memoryStore(snapshotOf({ [todos]: { todos: [] } }));
    const network = deferred();
    const request = startBootstrap(network.fetcher, "2026-11-16", store);
    network.answer({}, 401);
    await request; await flush();
    expect(state.cleared).toBe(1);
  });

  it("works without any snapshot", async () => {
    const { store } = memoryStore(null);
    const network = deferred();
    const request = startBootstrap(network.fetcher, "2026-11-16", store);
    expect(await snapshotAvailable()).toBe(false);
    const waiting = takePrimed(todos);
    network.answer({ [todos]: { todos: ["first"] } });
    await request;
    expect(await waiting).toEqual({ todos: ["first"] });
  });
});
