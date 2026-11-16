import { todayKey } from "../date";

/**
 * First-screen data arrives in one `/api/bootstrap` call that starts as soon as the page loads, in
 * parallel with the session check. Existing hooks keep requesting their own URLs; `api()` answers a
 * matching GET from this cache once and otherwise falls through to the network, so a failed or slow
 * bootstrap only costs the old behaviour.
 */
const TTL_MS = 30_000;
const TIMEOUT_MS = 8_000;

type Primed = { value: unknown; arrivedAt: number };
const primed = new Map<string, Primed>();
let expected = new Set<string>();
let inFlight: Promise<void> | null = null;

export const bootstrapPaths = (date: string): string[] => [
  "/api/categories?limit=100", "/api/todos?archived=all&limit=100", "/api/projects?archived=all&limit=100",
  "/api/planner-settings", "/api/timer", "/api/goals?limit=100", "/api/routines",
  `/api/time-entries?from=${date}&to=${date}`, `/api/daily-plans?date=${date}&limit=100`,
];

export function startBootstrap(fetcher: typeof fetch = fetch, date = todayKey()): Promise<void> {
  primed.clear();
  expected = new Set(bootstrapPaths(date));
  const request = fetcher(`/api/bootstrap?date=${date}`, { credentials: "include", signal: AbortSignal.timeout(TIMEOUT_MS) })
    .then(async (response) => {
      if (!response.ok) return;
      const body = await response.json() as { data?: Record<string, unknown> };
      const arrivedAt = Date.now();
      for (const [path, value] of Object.entries(body.data ?? {})) primed.set(path, { value, arrivedAt });
    })
    .catch(() => undefined)
    .finally(() => { if (inFlight === request) inFlight = null; });
  inFlight = request;
  return request;
}

export function clearBootstrap() {
  primed.clear();
  expected = new Set();
  inFlight = null;
}

/** Returns (once) the bootstrapped answer for a GET path, or undefined to use the network. */
export async function takePrimed<T>(path: string): Promise<T | undefined> {
  if (inFlight && expected.has(path)) await inFlight;
  const hit = primed.get(path);
  if (!hit) return undefined;
  primed.delete(path);
  const age = Date.now() - hit.arrivedAt;
  if (age > TTL_MS) return undefined;
  const value = hit.value as Record<string, unknown>;
  // Keep clock offsets right: the server timestamp is as old as the cached answer.
  if (value && typeof value === "object" && typeof value.serverNow === "string") {
    return { ...value, serverNow: new Date(Date.parse(value.serverNow) + age).toISOString() } as T;
  }
  return hit.value as T;
}
