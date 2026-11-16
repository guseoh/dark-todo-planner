import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapPaths, clearBootstrap, startBootstrap, takePrimed } from "./bootstrap";

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
    expect(await takePrimed("/api/memos?limit=100")).toBeUndefined();
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
