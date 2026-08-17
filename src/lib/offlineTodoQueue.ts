import { ApiError, api, jsonBody } from "./api/client";

const DB_NAME = "dark-todo-planner-offline";
const DB_VERSION = 1;
const STORE_NAME = "todo_mutations";
const MAX_QUEUE_SIZE = 250;

export const OFFLINE_TODO_QUEUE_CHANGED = "offline-todo-queue:changed";
export const OFFLINE_TODO_SYNC_REQUEST = "offline-todo-queue:sync-request";
export const OFFLINE_TODO_SYNCED = "offline-todo-queue:synced";

export type TodoMutationKind = "CREATE" | "UPDATE" | "BULK_UPDATE" | "TRASH" | "BULK_TRASH";
export type TodoMutationState = "PENDING" | "FAILED";

export type QueuedTodoMutation = {
  id?: number;
  kind: TodoMutationKind;
  method: "POST" | "PUT";
  path: string;
  body?: unknown;
  createdAt: string;
  attempts: number;
  state: TodoMutationState;
  lastError?: string;
};

export type OfflineTodoQueueSummary = {
  pending: number;
  failed: number;
  total: number;
  firstError?: string;
};

export type OfflineTodoFlushResult = {
  flushed: number;
  remaining: number;
  blocked: boolean;
};

const emptySummary = (): OfflineTodoQueueSummary => ({ pending: 0, failed: 0, total: 0 });

const supportsIndexedDb = () => typeof indexedDB !== "undefined";

const emit = (name: string) => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(name));
};

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!supportsIndexedDb()) {
    reject(new Error("이 브라우저에서는 오프라인 저장소를 사용할 수 없습니다."));
    return;
  }
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      store.createIndex("state", "state", { unique: false });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error("오프라인 저장소를 열지 못했습니다."));
});

const withStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = run(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("오프라인 저장소 요청에 실패했습니다."));
      transaction.onabort = () => reject(transaction.error || new Error("오프라인 저장소 작업이 중단되었습니다."));
    });
  } finally {
    db.close();
  }
};

export const listTodoMutations = async (): Promise<QueuedTodoMutation[]> => {
  if (!supportsIndexedDb()) return [];
  const values = await withStore<QueuedTodoMutation[]>("readonly", (store) => store.getAll());
  return values.sort((a, b) => (a.id || 0) - (b.id || 0));
};

export const summarizeTodoMutations = (mutations: QueuedTodoMutation[]): OfflineTodoQueueSummary => ({
  pending: mutations.filter((mutation) => mutation.state === "PENDING").length,
  failed: mutations.filter((mutation) => mutation.state === "FAILED").length,
  total: mutations.length,
  firstError: mutations.find((mutation) => mutation.state === "FAILED")?.lastError,
});

export const getOfflineTodoQueueSummary = async () => {
  try {
    return summarizeTodoMutations(await listTodoMutations());
  } catch {
    return emptySummary();
  }
};

export async function queueTodoMutation(input: Pick<QueuedTodoMutation, "kind" | "method" | "path" | "body">) {
  const existing = await listTodoMutations();
  if (existing.length >= MAX_QUEUE_SIZE) throw new Error(`오프라인 변경은 최대 ${MAX_QUEUE_SIZE}개까지 보관할 수 있습니다. 먼저 온라인에서 동기화해주세요.`);
  const mutation: QueuedTodoMutation = {
    ...input,
    createdAt: new Date().toISOString(),
    attempts: 0,
    state: "PENDING",
  };
  const id = await withStore<IDBValidKey>("readwrite", (store) => store.add(mutation));
  emit(OFFLINE_TODO_QUEUE_CHANGED);
  return { ...mutation, id: Number(id) };
}

const deleteMutation = async (id: number) => {
  await withStore<undefined>("readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
};

const updateMutation = async (mutation: QueuedTodoMutation) => {
  await withStore<IDBValidKey>("readwrite", (store) => store.put(mutation));
};

export const isRetryableTodoMutationError = (error: unknown) => !(error instanceof ApiError) || error.status >= 500;

const isAlreadyApplied = (mutation: QueuedTodoMutation, error: ApiError) =>
  error.status === 404 && (mutation.kind === "TRASH" || mutation.kind === "BULK_TRASH");

const sendMutation = async (mutation: QueuedTodoMutation) => {
  await api(mutation.path, {
    method: mutation.method,
    ...(mutation.body === undefined ? {} : jsonBody(mutation.body)),
  });
};

export async function flushTodoMutationQueue(): Promise<OfflineTodoFlushResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const summary = await getOfflineTodoQueueSummary();
    return { flushed: 0, remaining: summary.total, blocked: false };
  }

  const mutations = await listTodoMutations();
  let flushed = 0;
  for (const mutation of mutations) {
    if (!mutation.id) continue;
    if (mutation.state === "FAILED") return { flushed, remaining: mutations.length - flushed, blocked: true };
    try {
      await sendMutation(mutation);
      await deleteMutation(mutation.id);
      flushed += 1;
      emit(OFFLINE_TODO_QUEUE_CHANGED);
    } catch (error) {
      if (error instanceof ApiError && isAlreadyApplied(mutation, error)) {
        await deleteMutation(mutation.id);
        flushed += 1;
        emit(OFFLINE_TODO_QUEUE_CHANGED);
        continue;
      }
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 403) {
        mutation.state = "FAILED";
        mutation.attempts += 1;
        mutation.lastError = error.message;
        await updateMutation(mutation);
        emit(OFFLINE_TODO_QUEUE_CHANGED);
        return { flushed, remaining: mutations.length - flushed, blocked: true };
      }
      mutation.attempts += 1;
      mutation.lastError = error instanceof Error ? error.message : "네트워크 동기화에 실패했습니다.";
      await updateMutation(mutation);
      emit(OFFLINE_TODO_QUEUE_CHANGED);
      return { flushed, remaining: mutations.length - flushed, blocked: false };
    }
  }

  if (flushed > 0) emit(OFFLINE_TODO_SYNCED);
  return { flushed, remaining: 0, blocked: false };
}

export const requestOfflineTodoSync = () => emit(OFFLINE_TODO_SYNC_REQUEST);

export const shouldQueueTodoMutation = (error?: unknown) => {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return Boolean(error && !(error instanceof ApiError));
};
