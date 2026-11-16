/**
 * Last bootstrap answer, kept in IndexedDB so the next visit can draw the app before the network answers.
 * Anything that goes wrong here (private mode, quota, blocked upgrade) simply means "no snapshot".
 */
export type Snapshot = { savedAt: number; date: string; data: Record<string, unknown> };
export type SnapshotStore = {
  read: () => Promise<Snapshot | null>;
  write: (snapshot: Snapshot) => Promise<void>;
  clear: () => Promise<void>;
};

const DB_NAME = "dark-todo-planner-snapshot";
const STORE = "snapshots";
const KEY = "bootstrap";
/** Matches the session lifetime: an older snapshot could belong to a login that no longer exists. */
export const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 3_600_000;

const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB unavailable")); return; }
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => { request.result.createObjectStore(STORE); };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error("IndexedDB blocked"));
});

const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
};

const isSnapshot = (value: unknown): value is Snapshot => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Snapshot>;
  return typeof candidate.savedAt === "number" && typeof candidate.date === "string" && !!candidate.data && typeof candidate.data === "object";
};

export const indexedDbSnapshotStore: SnapshotStore = {
  async read() {
    try {
      const value = await run("readonly", (store) => store.get(KEY));
      if (!isSnapshot(value)) return null;
      return Date.now() - value.savedAt > SNAPSHOT_MAX_AGE_MS ? null : value;
    } catch { return null; }
  },
  async write(snapshot) {
    try { await run("readwrite", (store) => store.put(snapshot, KEY)); } catch { /* the snapshot is only an accelerator */ }
  },
  async clear() {
    try { await run("readwrite", (store) => store.delete(KEY)); } catch { /* nothing to clear */ }
  },
};
