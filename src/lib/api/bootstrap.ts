import { appFetch } from "./appFetch";
import { todayKey } from "../date";
import { markStartup } from "../perf";
import { indexedDbSnapshotStore, type SnapshotStore } from "./snapshot";

/**
 * First-screen data arrives in one `/api/bootstrap` call that starts as soon as the page loads, in
 * parallel with the session check. Existing hooks keep requesting their own URLs; `api()` answers a
 * matching GET from this cache once and otherwise falls through to the network, so a failed or slow
 * bootstrap only costs the old behaviour.
 *
 * The previous visit's answer is kept as a snapshot (IndexedDB). Planner lists are served from it
 * immediately ("stale first") while the fresh answer is fetched; if the fresh data differs, listeners
 * are told to reload quietly. Live state (running timer, routines, time entries) is never served stale.
 */
const TTL_MS = 30_000;
const TIMEOUT_MS = 8_000;
const REFRESH_DEBOUNCE_MS = 8_000;
const REFRESH_MIN_GAP_MS = 20_000;

type Primed = { value: unknown; arrivedAt: number; stale: boolean };
const primed = new Map<string, Primed>();
/** What each stale answer looked like when a hook consumed it, to detect a changed fresh answer. */
const staleServed = new Map<string, unknown>();
let expected = new Set<string>();
let inFlight: Promise<void> | null = null;
let snapshotReady: Promise<boolean> = Promise.resolve(false);
let store: SnapshotStore = indexedDbSnapshotStore;
/** Invalidates callbacks of an earlier startBootstrap (login/logout, tests). */
let generation = 0;
/** Counts writes made by the user; a fresh answer fetched before a write may predate it. */
let mutationCount = 0;
const listeners = new Set<() => void>();

export const bootstrapPaths = (date: string): string[] => [
  "/api/categories?limit=100", "/api/todos?archived=all&limit=100", "/api/projects?archived=all&limit=100",
  "/api/planner-settings", "/api/timer", "/api/goals?limit=100", "/api/routines",
  "/api/memos?limit=100", "/api/milestones?limit=100", "/api/project-decisions?limit=100",
  `/api/time-entries?from=${date}&to=${date}`, `/api/daily-plans?date=${date}&limit=100`,
];

const LIVE_ONLY = /^\/api\/(timer|routines|time-entries)(\?|$)/;
const staleAllowed = (path: string) => !LIVE_ONLY.test(path);
const sameValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const notify = () => listeners.forEach((listener) => listener());

/** Called after stale data was shown and the fresh answer turned out different (or a write raced it). */
export function onRevalidated(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Resolves true when a usable snapshot was loaded, so the app can draw before the session check returns. */
export const snapshotAvailable = () => snapshotReady;

export function startBootstrap(fetcher: typeof fetch = appFetch, date = todayKey(), snapshotStore: SnapshotStore = indexedDbSnapshotStore): Promise<void> {
  const mine = ++generation;
  store = snapshotStore;
  primed.clear();
  staleServed.clear();
  expected = new Set(bootstrapPaths(date));
  const startedMutations = mutationCount;
  markStartup("bootstrap-sent");

  snapshotReady = snapshotStore.read().then((snapshot) => {
    if (mine !== generation || !snapshot) return false;
    let any = false;
    for (const [path, value] of Object.entries(snapshot.data)) {
      if (!expected.has(path) || !staleAllowed(path) || primed.has(path)) continue;
      primed.set(path, { value, arrivedAt: Date.now(), stale: true });
      any = true;
    }
    if (any) markStartup("snapshot-loaded");
    return any;
  }).catch(() => false);

  const request = fetcher(`/api/bootstrap?date=${date}`, { credentials: "include", signal: AbortSignal.timeout(TIMEOUT_MS) })
    .then(async (response) => {
      if (mine !== generation) return;
      if (response.status === 401) { await snapshotStore.clear(); return; }
      if (!response.ok) return;
      const body = await response.json() as { data?: Record<string, unknown> };
      const data = body.data ?? {};
      await snapshotReady;
      if (mine !== generation) return;
      markStartup("bootstrap-done");
      // A write made while this answer was in flight may not be part of it; let the hooks reload normally.
      const raced = mutationCount !== startedMutations;
      let changed = false;
      if (!raced) {
        const arrivedAt = Date.now();
        for (const [path, value] of Object.entries(data)) {
          if (staleServed.has(path) && sameValue(staleServed.get(path), value)) continue;
          if (staleServed.has(path)) changed = true;
          primed.set(path, { value, arrivedAt, stale: false });
        }
        void snapshotStore.write({ savedAt: Date.now(), date, data });
      }
      if (staleServed.size && (changed || raced)) {
        staleServed.clear();
        markStartup("revalidated");
        notify();
      }
    })
    .catch(() => undefined)
    .finally(() => { if (inFlight === request) inFlight = null; });
  inFlight = request;
  return request;
}

export function clearBootstrap() {
  generation += 1;
  primed.clear();
  staleServed.clear();
  expected = new Set();
  inFlight = null;
  snapshotReady = Promise.resolve(false);
}

/** Forgets the stored snapshot (logout, expired session). */
export const discardSnapshot = () => store.clear();

/** Returns (once) the bootstrapped answer for a GET path, or undefined to use the network. */
export async function takePrimed<T>(path: string): Promise<T | undefined> {
  const isExpected = expected.has(path);
  if (isExpected) await snapshotReady;
  let hit = primed.get(path);
  if (!hit && inFlight && isExpected) {
    await inFlight;
    hit = primed.get(path);
  }
  if (!hit) return undefined;
  primed.delete(path);
  if (hit.stale) {
    staleServed.set(path, hit.value);
    return hit.value as T;
  }
  const age = Date.now() - hit.arrivedAt;
  if (age > TTL_MS) return undefined;
  const value = hit.value as Record<string, unknown>;
  // Keep clock offsets right: the server timestamp is as old as the cached answer.
  if (value && typeof value === "object" && typeof value.serverNow === "string") {
    return { ...value, serverNow: new Date(Date.parse(value.serverNow) + age).toISOString() } as T;
  }
  return hit.value as T;
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let lastRefreshAt = 0;

async function refreshSnapshot(fetcher: typeof fetch = appFetch) {
  lastRefreshAt = Date.now();
  const date = todayKey();
  try {
    const response = await fetcher(`/api/bootstrap?date=${date}`, { credentials: "include", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return;
    const body = await response.json() as { data?: Record<string, unknown> };
    if (body.data) await store.write({ savedAt: Date.now(), date, data: body.data });
  } catch { /* the next write schedules another attempt */ }
}

/** Records a user write: invalidates racing bootstrap answers and refreshes the snapshot once things settle. */
export function noteMutation() {
  mutationCount += 1;
  if (typeof window === "undefined") return;
  clearTimeout(refreshTimer);
  const wait = Math.max(REFRESH_DEBOUNCE_MS, REFRESH_MIN_GAP_MS - (Date.now() - lastRefreshAt));
  refreshTimer = setTimeout(() => { void refreshSnapshot(); }, wait);
}
