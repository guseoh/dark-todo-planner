import { invoke } from "@tauri-apps/api/core";
import { beginMaintenance } from "./desktopSafety";
import { listTodoMutations } from "./offlineTodoQueue";

export type UpdateState = { installedVersion: string; availableVersion: string | null };
type Command = (args: { checkNow: boolean; install: boolean; expectedVersion: string | null }) => Promise<UpdateState>;

// Both React entry points use the same coordinator. Native Rust independently
// enforces exclusive access and the approved version even if IPC is called directly.
export function createDesktopUpdater(command: Command, pending: () => Promise<unknown[]>, prepare: () => (() => void) = () => () => {}) {
  let checking: Promise<UpdateState> | null = null;
  let installing: Promise<UpdateState> | null = null;
  return {
    version: () => command({ checkNow: false, install: false, expectedVersion: null }),
    check(): Promise<UpdateState> {
      if (installing) return Promise.reject(new Error("업데이트 설치가 진행 중입니다."));
      if (checking) return checking;
      checking = Promise.resolve().then(() => command({ checkNow: true, install: false, expectedVersion: null }))
        .finally(() => { checking = null; });
      return checking;
    },
    install(expectedVersion: string): Promise<UpdateState> {
      if (!expectedVersion) return Promise.reject(new Error("업데이트 버전을 먼저 확인해 주세요."));
      if (checking || installing) return Promise.reject(new Error("다른 업데이트 작업이 진행 중입니다."));
      installing = Promise.resolve().then(async () => {
        // Fail closed on a storage read error. Never delete or flush pending work
        // as a side effect of updating. Other editor drafts still need user review.
        const release = prepare();
        try {
        let mutations: unknown[];
        try { mutations = await pending(); }
        catch { throw new Error("오프라인 저장소를 확인하지 못했습니다. 저장 상태를 확인한 후 다시 시도해 주세요."); }
        if (mutations.length) throw new Error("동기화되지 않은 Todo 변경이 있습니다. 먼저 동기화를 완료해 주세요.");
        return await command({ checkNow: true, install: true, expectedVersion });
        } finally { release(); }
      }).finally(() => { installing = null; });
      return installing;
    },
  };
}

export const desktopUpdater = createDesktopUpdater(
  (args) => invoke<UpdateState>("desktop_update", args),
  async () => {
    if (typeof indexedDB === "undefined") throw new Error("IndexedDB unavailable");
    return listTodoMutations();
  },
  beginMaintenance,
);

export const updateErrorMessage = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : typeof cause === "string" ? cause : fallback;
